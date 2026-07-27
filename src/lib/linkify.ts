export type TextSegment =
  { type: 'text'; value: string } | { type: 'link'; href: string; value: string }

export function linkify(text: string): TextSegment[] {
  const segments: TextSegment[] = []
  const urlRegex = /(https?:\/\/[^\s<>[\]{}|\\^`"]+)/g

  let lastIndex = 0
  let match

  while ((match = urlRegex.exec(text)) !== null) {
    // Add text before the URL
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.substring(lastIndex, match.index) })
    }

    // Add the URL
    const url = match[0]
    segments.push({ type: 'link', href: url, value: url })

    lastIndex = urlRegex.lastIndex
  }

  // Add remaining text
  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.substring(lastIndex) })
  }

  return segments.length === 0 ? [{ type: 'text', value: text }] : segments
}
