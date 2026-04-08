/**
 * Script to generate bcrypt hashes for passwords
 * Run: npx tsx scripts/generate-hash.ts
 * 
 * Or use: npx ts-node scripts/generate-hash.ts
 */

import bcrypt from 'bcryptjs';

// Passwords to hash
const passwords = ['admin123', 'branch123'];

async function generateHashes() {
  console.log('🔐 Generating bcrypt hashes...\n');
  
  for (const password of passwords) {
    const salt = await bcrypt.genSalt(10);
    const hash = await bcrypt.hash(password, salt);
    
    console.log(`Password: "${password}"`);
    console.log(`Hash: ${hash}`);
    console.log('---');
  }
  
  // Also verify the branch123 hash works
  console.log('\n✅ Testing hash verification...');
  const testPassword = 'branch123';
  const testHash = await bcrypt.hash(testPassword, 10);
  console.log(`Generated hash for "${testPassword}": ${testHash}`);
  
  const isValid = await bcrypt.compare(testPassword, testHash);
  console.log(`Verification: ${isValid ? 'SUCCESS' : 'FAILED'}`);
}

generateHashes().catch(console.error);