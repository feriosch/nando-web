// What a ceremony's `begin` answers: the options to hand to the device's Passkeys.
export type Begin<Options> = { publicKey: Options }

// The device's Passkeys (Face ID on iPhone). Each takes the options the server's `begin` sent and
// returns what its `finish` takes. They reject with the browser's DOMException, such as
// `NotAllowedError` when the Owner cancels Face ID.
export type Passkeys = {
  // Signs in with one of the Owner's Passkeys.
  get(options: PublicKeyCredentialRequestOptionsJSON): Promise<unknown>
  // Registers a new Passkey on this device.
  create(options: PublicKeyCredentialCreationOptionsJSON): Promise<unknown>
}

export const browserPasskeys: Passkeys = {
  async get(options) {
    const publicKey = PublicKeyCredential.parseRequestOptionsFromJSON(options)
    return toJSON(await navigator.credentials.get({ publicKey }))
  },
  async create(options) {
    const publicKey = PublicKeyCredential.parseCreationOptionsFromJSON(options)
    return toJSON(await navigator.credentials.create({ publicKey }))
  },
}

// A browser may answer with no credential at all; treat that like a cancelled Face ID prompt.
function toJSON(credential: Credential | null): unknown {
  if (!(credential instanceof PublicKeyCredential)) {
    throw new DOMException('No Passkey was returned.', 'NotAllowedError')
  }
  return credential.toJSON()
}
