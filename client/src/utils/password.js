// Même règle que le serveur et l'app mobile : 8 caractères, au moins une
// lettre et un chiffre. Renvoie le message d'erreur, ou null si valide.
export function passwordError(password, language = 'fr') {
  const ar = language === 'ar';
  if (!password || password.length < 8) {
    return ar ? 'يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.' : 'Le mot de passe doit contenir au moins 8 caractères.';
  }
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    return ar ? 'يجب أن تحتوي كلمة المرور على حرف ورقم على الأقل.' : 'Le mot de passe doit contenir au moins une lettre et un chiffre.';
  }
  return null;
}

export const PASSWORD_HINT = {
  fr: '8 caractères minimum, avec au moins une lettre et un chiffre.',
  ar: '8 أحرف على الأقل، مع حرف ورقم على الأقل.',
};
