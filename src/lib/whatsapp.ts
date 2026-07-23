// Utilidades para abrir chats de WhatsApp con mensaje precargado (wa.me).

export function formatPhoneForWhatsApp(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, "");
  // If it starts with 0, replace with country code (assume Uruguay 598)
  if (cleaned.startsWith("0")) {
    return "598" + cleaned.slice(1);
  }
  // If it doesn't start with country code, add 598
  if (!cleaned.startsWith("598") && cleaned.length <= 9) {
    return "598" + cleaned;
  }
  return cleaned;
}

export function openWhatsApp(phone: string, message: string) {
  const formattedPhone = formatPhoneForWhatsApp(phone);
  const encodedMessage = encodeURIComponent(message);
  const url = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;
  window.open(url, "_blank");
}
