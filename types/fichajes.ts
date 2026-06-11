export interface EstadoFichaje {
  abierto: boolean;
  fichaje_id?: string;
  entrada_at?: string;
}

export interface FichajeHistorial {
  fichaje_id: string;
  user_id: string;
  nombre: string;
  entrada_at: string;
  salida_at: string | null;
  duracion_min: number | null;
  nota: string | null;
}

export interface FichajeAccionResult {
  ok: boolean;
  id?: string;
  error?: string;
}
