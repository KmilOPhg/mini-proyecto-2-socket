import { Router, type Request, type Response, type NextFunction } from "express";
import { notificarSalaTerminada } from "../socket/index.js";
import { contarUsuariosEnLinea, listarPresenciaSala } from "../socket/presence.js";

const router = Router();

/** Valida la clave interna. Si INTERNAL_API_KEY no está configurada, permite todo (modo desarrollo). */
function requireInternalKey(req: Request, res: Response, next: NextFunction) {
  const key = process.env.INTERNAL_API_KEY?.trim();
  if (!key) return next();
  if (req.headers["x-internal-api-key"] !== key) {
    res.status(401).json({ status: "error", msg: "Clave interna no válida." });
    return;
  }
  next();
}

router.use(requireInternalKey);

/**
 * POST /internal/notificar-sala-terminada
 * El backend principal llama a este endpoint cuando elimina una sala
 * para que el socket server emita "sala:terminada" a todos los conectados.
 */
router.post("/notificar-sala-terminada", (req: Request, res: Response) => {
  const { salaId, mensaje } = req.body as { salaId?: unknown; mensaje?: unknown };
  if (typeof salaId !== "string" || !salaId.trim()) {
    res.status(400).json({ status: "error", msg: "salaId es obligatorio." });
    return;
  }
  notificarSalaTerminada(
    salaId.trim(),
    typeof mensaje === "string" ? mensaje : undefined
  );
  res.json({ status: "success", msg: "Notificación enviada." });
});

/**
 * GET /internal/presencia/:salaId
 * Devuelve la lista de usuarios en línea en una sala.
 */
router.get("/presencia/:salaId", (req: Request, res: Response) => {
  const salaId = String(req.params.salaId ?? "");
  const usuarios = listarPresenciaSala(salaId);
  res.json({ status: "success", data: { salaId, usuarios } });
});

/**
 * GET /internal/presencia/:salaId/count
 * Devuelve el conteo de usuarios en línea en una sala.
 */
router.get("/presencia/:salaId/count", (req: Request, res: Response) => {
  const salaId = String(req.params.salaId ?? "");
  const count = contarUsuariosEnLinea(salaId);
  res.json({ status: "success", data: { salaId, count } });
});

export default router;
