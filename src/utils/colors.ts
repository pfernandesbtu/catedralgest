export const SACRAMENT_COLORS = [
  { id: 'blue', label: 'Azul', bg: 'bg-blue-100', text: 'text-blue-800', border: 'border-blue-200', badge: 'bg-blue-100 text-blue-800 border-blue-200', portalTheme: 'from-blue-700 to-blue-900', portalBadge: 'bg-white text-blue-900', portalText: 'text-blue-600', pdfHead: [29, 78, 216] },
  { id: 'red', label: 'Vermelho', bg: 'bg-red-100', text: 'text-red-800', border: 'border-red-200', badge: 'bg-red-100 text-red-800 border-red-200', portalTheme: 'from-red-700 to-red-900', portalBadge: 'bg-white text-red-900', portalText: 'text-red-600', pdfHead: [185, 28, 28] },
  { id: 'green', label: 'Verde', bg: 'bg-green-100', text: 'text-green-800', border: 'border-green-200', badge: 'bg-green-100 text-green-800 border-green-200', portalTheme: 'from-green-700 to-green-900', portalBadge: 'bg-white text-green-900', portalText: 'text-green-600', pdfHead: [21, 128, 61] },
  { id: 'purple', label: 'Roxo', bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', badge: 'bg-purple-100 text-purple-800 border-purple-200', portalTheme: 'from-purple-700 to-purple-900', portalBadge: 'bg-white text-purple-900', portalText: 'text-purple-600', pdfHead: [126, 34, 206] },
  { id: 'amber', label: 'Laranja', bg: 'bg-amber-100', text: 'text-amber-800', border: 'border-amber-200', badge: 'bg-amber-100 text-amber-800 border-amber-200', portalTheme: 'from-amber-600 to-amber-800', portalBadge: 'bg-white text-amber-900', portalText: 'text-amber-600', pdfHead: [217, 119, 6] },
  { id: 'rose', label: 'Rosa', bg: 'bg-rose-100', text: 'text-rose-800', border: 'border-rose-200', badge: 'bg-rose-100 text-rose-800 border-rose-200', portalTheme: 'from-rose-700 to-rose-900', portalBadge: 'bg-white text-rose-900', portalText: 'text-rose-600', pdfHead: [225, 29, 72] },
  { id: 'indigo', label: 'Índigo', bg: 'bg-indigo-100', text: 'text-indigo-800', border: 'border-indigo-200', badge: 'bg-indigo-100 text-indigo-800 border-indigo-200', portalTheme: 'from-indigo-700 to-indigo-900', portalBadge: 'bg-white text-indigo-900', portalText: 'text-indigo-600', pdfHead: [67, 56, 202] },
  { id: 'teal', label: 'Verde Água', bg: 'bg-teal-100', text: 'text-teal-800', border: 'border-teal-200', badge: 'bg-teal-100 text-teal-800 border-teal-200', portalTheme: 'from-teal-700 to-teal-900', portalBadge: 'bg-white text-teal-900', portalText: 'text-teal-600', pdfHead: [15, 118, 110] },
];

export const getSacramentColor = (sacrament: string, colorsMap?: Record<string, string>, fallbackIndex = 0) => {
    if (!sacrament) return SACRAMENT_COLORS[0];
    const colorId = colorsMap?.[sacrament];
    if (colorId) {
        const found = SACRAMENT_COLORS.find(c => c.id === colorId);
        if (found) return found;
    }
    const validIndex = fallbackIndex < 0 ? 0 : fallbackIndex % SACRAMENT_COLORS.length;
    return SACRAMENT_COLORS[validIndex] || SACRAMENT_COLORS[0];
};
