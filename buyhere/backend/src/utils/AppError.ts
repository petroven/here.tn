/**
 * Erreur métier « attendue » : le middleware d'erreurs la renvoie telle quelle
 * au client avec son statut HTTP. Toute autre erreur devient un 500 générique.
 */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new AppError(400, code, message, details);
  }
  static unauthorized(message = 'Authentification requise', code = 'UNAUTHORIZED') {
    return new AppError(401, code, message);
  }
  static forbidden(message = 'Accès refusé', code = 'FORBIDDEN') {
    return new AppError(403, code, message);
  }
  static notFound(message = 'Ressource introuvable', code = 'NOT_FOUND') {
    return new AppError(404, code, message);
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new AppError(409, code, message);
  }
}
