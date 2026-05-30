/** Tipo de payload en el JWT del estudiante */
export type JwtUserPayload = {
  /** UID del documento en Firestore (`usuarios`) */
  id: string;
  nombre: string;
  email: string | null;
  /** ID del rol (ej. `"estudiante"`) */
  rolId: string;
  estado: "ACTIVO" | "INACTIVO";
  clienteId: string | null;
};
