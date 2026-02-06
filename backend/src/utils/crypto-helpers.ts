import { randomBytes, pbkdf2Sync, createCipheriv, createDecipheriv } from 'crypto';

/**
 * Encrypted payload structure for credentials.enc file
 */
export interface EncryptedPayload {
  version: string;
  algorithm: string;
  kdf: string;
  iterations: number;
  salt: string;
  iv: string;
  authTag: string;
  data: string;
}

/**
 * Credentials structure stored in encrypted payload
 */
export interface CredentialsData {
  integrations: Record<string, Record<string, string>>;
}

/**
 * Sensitive field names to encrypt
 */
export const SENSITIVE_FIELDS = ['password', 'token', 'tokenSecret', 'apiKey'];

/**
 * Encrypt credentials using AES-256-GCM with PBKDF2 key derivation
 * @param data - The credentials data to encrypt
 * @param password - The encryption password
 * @returns The encrypted payload
 */
export function encryptCredentials(data: CredentialsData, password: string): EncryptedPayload {
  const salt = randomBytes(32);
  const iv = randomBytes(16);
  const iterations = 100000;

  // Derive key using PBKDF2
  const key = pbkdf2Sync(password, salt, iterations, 32, 'sha256');

  // Create cipher with AES-256-GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);

  // Encrypt the data
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(data), 'utf8'),
    cipher.final()
  ]);

  // Get authentication tag
  const authTag = cipher.getAuthTag();

  return {
    version: '1.0',
    algorithm: 'aes-256-gcm',
    kdf: 'pbkdf2',
    iterations,
    salt: salt.toString('base64'),
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    data: encrypted.toString('base64')
  };
}

/**
 * Decrypt credentials using AES-256-GCM with PBKDF2 key derivation
 * @param payload - The encrypted payload
 * @param password - The decryption password
 * @returns The decrypted credentials data
 * @throws Error if decryption fails (wrong password or corrupted data)
 */
export function decryptCredentials(payload: EncryptedPayload, password: string): CredentialsData {
  // Decode base64 values
  const salt = Buffer.from(payload.salt, 'base64');
  const iv = Buffer.from(payload.iv, 'base64');
  const authTag = Buffer.from(payload.authTag, 'base64');
  const encrypted = Buffer.from(payload.data, 'base64');

  // Derive key using same parameters
  const key = pbkdf2Sync(password, salt, payload.iterations, 32, 'sha256');

  // Create decipher
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  // Decrypt the data
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final()
  ]);

  return JSON.parse(decrypted.toString('utf8')) as CredentialsData;
}

/**
 * Validate an encrypted payload structure
 * @param payload - The payload to validate
 * @returns true if valid, false otherwise
 */
export function isValidEncryptedPayload(payload: unknown): payload is EncryptedPayload {
  if (!payload || typeof payload !== 'object') return false;

  const p = payload as Record<string, unknown>;

  return (
    typeof p.version === 'string' &&
    typeof p.algorithm === 'string' &&
    typeof p.kdf === 'string' &&
    typeof p.iterations === 'number' &&
    typeof p.salt === 'string' &&
    typeof p.iv === 'string' &&
    typeof p.authTag === 'string' &&
    typeof p.data === 'string'
  );
}
