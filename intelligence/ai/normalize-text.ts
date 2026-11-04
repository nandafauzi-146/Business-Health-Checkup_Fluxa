export function normalizeAiResponseText(text: string): string {
  return text.replace(/(\S)[ \t]*\u2014[ \t]*(\S)/g, '$1, $2').replace(/\u2014/g, '').trim()
}
