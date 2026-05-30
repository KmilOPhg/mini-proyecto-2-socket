import type { Timestamp } from "firebase-admin/firestore";

export type PrivacidadSala = "publica" | "enlace";

export type SalaFirestore = {
  nombre: string;
  creadorUid: string;
  participantes: string[];
  codigoInvitacion?: string;
  aforoMaximo: number;
  privacidad: PrivacidadSala;
  materia?: string;
  descripcion?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type SalaPublica = {
  id: string;
  nombre: string;
  creadorUid: string;
  participantes: string[];
  codigoInvitacion: string | null;
  aforoMaximo: number;
  privacidad: PrivacidadSala;
  materia: string | null;
  descripcion: string | null;
  esCreador: boolean;
  usuariosEnLinea: number;
  createdAt: string | null;
  updatedAt: string | null;
};

export type MensajePublico = {
  id: string;
  salaId: string;
  uid: string;
  username: string;
  texto: string;
  createdAt: string | null;
};
