export const cookieUtils = {
  set(name: string, value: string, days: number = 7): void {
    const expires = new Date()
    expires.setTime(expires.getTime() + days * 24 * 60 * 60 * 1000)
    const expiresStr = `expires=${expires.toUTCString()}`
    const sameSite = 'SameSite=Strict'
    const path = 'Path=/'
    const secure = process.env.NODE_ENV === 'production' ? 'Secure' : ''

    document.cookie = `${name}=${encodeURIComponent(value)};${expiresStr};${path};${sameSite};${secure}`
  },

  get(name: string): string | null {
    const nameEQ = `${name}=`
    const cookies = document.cookie.split(';')

    for (const cookie of cookies) {
      let c = cookie.trim()
      if (c.startsWith(nameEQ)) {
        return decodeURIComponent(c.substring(nameEQ.length))
      }
    }
    return null
  },

  delete(name: string): void {
    this.set(name, '', -1)
  },

  clear(names: string[]): void {
    names.forEach(name => this.delete(name))
  }
}
