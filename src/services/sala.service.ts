import { FieldValue, type DocumentData, type Timestamp } from "firebase-admin/firestore";
import { getDb } from "../../lib/firebase.js";
import { collections } from "../../lib/firestoreCollections.js";
import type {
  MensajePublico,
  PrivacidadSala,
  SalaFirestore,
  SalaPublica,
} from "../types/sala.types.js";
import { AppError } from "../utils/AppError.js";
import { contarUsuariosEnLinea, listarPresenciaSala } from "../socket/presence.js";

const AFORO_MIN = 2;
const AFORO_MAX = 50;
const MENSAJE_MAX = 2000;

function timestampToIso(value: Timestamp | undefined): string | null {
  if (!value || typeof value.toDate !== "function") return null;
  return value.toDate().toISOString();
}

function normalizarTextoMensaje(texto: string): string {
  const limpio = texto.trim();
  if (!limpio) throw new AppError("El mensaje no puede estar vacío.", 400);
  if (limpio.length > MENSAJE_MAX) {
    throw new AppError(`El mensaje no puede superar ${MENSAJE_MAX} caracteres.`, 400);
  }
  return limpio;
}

function asSalaRow(data: DocumentData | undefined): SalaFirestore | null {
  if (!data || typeof data.nombre !== "string" || typeof data.creadorUid !== "string") return null;
  const participantes = Array.isArray(data.participantes)
    ? data.participantes.filter((p): p is string => typeof p === "string")
    : [];
  const aforoRaw = Number(data.aforoMaximo);
  const aforoMaximo =
    Number.isFinite(aforoRaw) && aforoRaw >= AFORO_MIN && aforoRaw <= AFORO_MAX
      ? Math.floor(aforoRaw)
      : AFORO_MAX;
  const privacidad: PrivacidadSala = data.privacidad === "publica" ? "publica" : "enlace";
  return {
    nombre: data.nombre,
    creadorUid: data.creadorUid,
    participantes,
    codigoInvitacion:
      typeof data.codigoInvitacion === "string" ? data.codigoInvitacion : undefined,
    aforoMaximo,
    privacidad,
    materia: typeof data.materia === "string" ? data.materia : undefined,
    descripcion: typeof data.descripcion === "string" ? data.descripcion : undefined,
    createdAt: data.createdAt as Timestamp | undefined,
    updatedAt: data.updatedAt as Timestamp | undefined,
  };
}

function toSalaPublica(id: string, row: SalaFirestore, uidConsulta: string): SalaPublica {
  return {
    id,
    nombre: row.nombre,
    creadorUid: row.creadorUid,
    participantes: row.participantes,
    codigoInvitacion: row.codigoInvitacion ?? null,
    aforoMaximo: row.aforoMaximo,
    privacidad: row.privacidad,
    materia: row.materia ?? null,
    descripcion: row.descripcion ?? null,
    esCreador: row.creadorUid === uidConsulta,
    usuariosEnLinea: contarUsuariosEnLinea(id),
    createdAt: timestampToIso(row.createdAt),
    updatedAt: timestampToIso(row.updatedAt),
  };
}

function tieneAccesoSala(row: SalaFirestore, uid: string): boolean {
  if (row.creadorUid === uid) return true;
  return row.participantes.includes(uid);
}

async function obtenerDocumentoSala(salaId: string) {
  const ref = getDb().collection(collections.salas).doc(salaId);
  const snap = await ref.get();
  if (!snap.exists) throw new AppError("La sala no existe.", 404);
  const row = asSalaRow(snap.data());
  if (!row) throw new AppError("La sala tiene un formato inválido.", 500);
  return { ref, snap, row };
}

function verificarCupoEnLinea(salaId: string, row: SalaFirestore, uid: string): void {
  const yaEnLinea = listarPresenciaSala(salaId).some((u) => u.uid === uid);
  if (yaEnLinea) return;
  if (contarUsuariosEnLinea(salaId) >= row.aforoMaximo) {
    throw new AppError("La sala está llena en este momento.", 403);
  }
}

/** Nombre visible en salas: nombre completo, username o email. */
export async function obtenerNombreVisible(uid: string): Promise<string> {
  const snap = await getDb().collection(collections.usuarios).doc(uid).get();
  if (!snap.exists) throw new AppError("Usuario no encontrado.", 404);
  const data = snap.data()!;
  const nombres = typeof data.nombres === "string" ? data.nombres.trim() : "";
  const apellidos = typeof data.apellidos === "string" ? data.apellidos.trim() : "";
  const compuesto = `${nombres} ${apellidos}`.trim();
  if (compuesto) return compuesto;
  if (typeof data.username === "string" && data.username.trim()) {
    return data.username.trim();
  }
  return typeof data.email === "string" ? data.email : uid;
}

async function obtenerSala(salaId: string, uid: string): Promise<SalaPublica> {
  const { row } = await obtenerDocumentoSala(salaId);
  if (!tieneAccesoSala(row, uid)) throw new AppError("No tenés acceso a esta sala.", 403);
  return toSalaPublica(salaId, row, uid);
}

/** Verificar acceso y cupo en línea al entrar por WebSocket. */
export async function verificarAccesoSala(salaId: string, uid: string): Promise<SalaPublica> {
  const sala = await obtenerSala(salaId, uid);
  const { row } = await obtenerDocumentoSala(salaId);
  verificarCupoEnLinea(salaId, row, uid);
  return sala;
}

/** Guardar mensaje de texto en Firestore. */
export async function guardarMensaje(
  salaId: string,
  uid: string,
  texto: string
): Promise<MensajePublico> {
  const textoNormalizado = normalizarTextoMensaje(texto);
  const { ref, row } = await obtenerDocumentoSala(salaId);
  if (!tieneAccesoSala(row, uid)) throw new AppError("No tenés acceso a esta sala.", 403);

  const username = await obtenerNombreVisible(uid);
  const mensajeRef = ref.collection(collections.mensajes).doc();
  const now = FieldValue.serverTimestamp();
  await mensajeRef.set({ uid, username, texto: textoNormalizado, createdAt: now });

  const created = await mensajeRef.get();
  const data = created.data();
  return {
    id: mensajeRef.id,
    salaId,
    uid,
    username,
    texto: textoNormalizado,
    createdAt: timestampToIso(data?.createdAt as Timestamp | undefined),
  };
}
