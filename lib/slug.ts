// Helper to generate strictly numeric Room IDs for BeamShare rooms (e.g. 4595588)

export function generateRoomId(): string {
  // Generate strictly 7-digit numeric Room ID with NO text (e.g., 4595588)
  return Math.floor(1000000 + Math.random() * 9000000).toString();
}

export function isValidRoomId(id: string): boolean {
  return typeof id === 'string' && id.trim().length >= 3 && /^[a-zA-Z0-9_-]+$/.test(id.trim());
}
