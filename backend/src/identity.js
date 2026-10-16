export function requireIdentity(verifyToken) {
  return async (req, res, next) => {
    const header = req.get('Authorization') || '';
    if (!/^Bearer [^\s]+$/.test(header) || header.length > 8192)
      return res.status(401).json({ error: 'Debes iniciar sesión.' });
    try {
      const decoded = await verifyToken(header.slice(7));
      if (!decoded || typeof decoded.uid !== 'string' || !decoded.uid) throw new Error('invalid');
      req.identity = { uid: decoded.uid, email: decoded.email || null, admin: decoded.admin === true };
      next();
    } catch {
      res.status(401).json({ error: 'Acceso no válido. Inicia sesión nuevamente.' });
    }
  };
}
