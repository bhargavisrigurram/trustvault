import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

interface MutationTarget {
  name: string;
  filePath: string;
  originalSnippet: string;
  mutatedSnippet: string;
  testSuite: string;
  description: string;
}

const targets: MutationTarget[] = [
  {
    name: 'Bypass Central Authorization Engine (Always Allow All Actions)',
    filePath: path.resolve('apps/api/src/modules/authorization/index.ts'),
    originalSnippet: `export async function authorize(
  user: User | null | undefined,
  document: Document | null | undefined,
  action: DocumentActionType,
  options?: AuthorizeOptions
): Promise<AuthorizationResult> {`,
    mutatedSnippet: `export async function authorize(
  user: User | null | undefined,
  document: Document | null | undefined,
  action: DocumentActionType,
  options?: AuthorizeOptions
): Promise<AuthorizationResult> {
  // [MUTATION INJECTED]: Unconditionally allow unauthorized access
  return { allowed: true };`,
    testSuite: 'tests/security/threat-matrix.test.ts',
    description: 'Bypasses the mandatory central authorize() function, returning allowed: true for all requests.',
  },
  {
    name: 'Bypass Document Download Authorization in Service Layer',
    filePath: path.resolve('apps/api/src/modules/documents/document.service.ts'),
    originalSnippet: `    // Central authorization rule: download action
    const authRes = await authorize(user, doc, DocumentAction.DOWNLOAD);`,
    mutatedSnippet: `    // Central authorization rule: download action
    // [MUTATION INJECTED]: Bypassing download authorization check
    const authRes = { allowed: true } as any;`,
    testSuite: 'tests/security/threat-matrix.test.ts',
    description: 'Bypasses authorization check specifically inside getDocumentFileStream().',
  },
  {
    name: 'Bypass Document Metadata Authorization in Service Layer',
    filePath: path.resolve('apps/api/src/modules/documents/document.service.ts'),
    originalSnippet: `    // Mandatory authorization boundary check
    const authRes = await authorize(user, docWithVer.document, DocumentAction.READ);`,
    mutatedSnippet: `    // Mandatory authorization boundary check
    // [MUTATION INJECTED]: Bypassing metadata read authorization check
    const authRes = { allowed: true } as any;`,
    testSuite: 'tests/security/threat-matrix.test.ts',
    description: 'Bypasses authorization check inside getDocument() metadata resolver.',
  },
];

async function runMutationTests() {
  console.log('='.repeat(80));
  console.log(' TRUSTVAULT AST/CONTROLLED MUTATION TESTING HARNESS');
  console.log(' Verifies that removing or altering authorization calls causes security tests to fail');
  console.log('='.repeat(80));

  let passedMutations = 0;
  let failedMutations = 0;

  for (const target of targets) {
    console.log(`\n[Mutation]: ${target.name}`);
    console.log(`Target File: ${target.filePath}`);
    console.log(`Description: ${target.description}`);

    if (!fs.existsSync(target.filePath)) {
      console.error(`ERROR: Target file does not exist: ${target.filePath}`);
      process.exit(1);
    }

    const originalContent = fs.readFileSync(target.filePath, 'utf8');

    if (!originalContent.includes(target.originalSnippet)) {
      console.error(`ERROR: Original snippet not found in target file: ${target.filePath}`);
      console.error(`Snippet:\n${target.originalSnippet}`);
      process.exit(1);
    }

    // Apply Mutation
    const mutatedContent = originalContent.replace(
      target.originalSnippet,
      target.mutatedSnippet
    );

    let testFailedAsExpected = false;

    try {
      // Write mutated code to file
      fs.writeFileSync(target.filePath, mutatedContent, 'utf8');
      console.log('Mutation applied. Running security test suite...');

      try {
        // Run test suite; if authorization was removed, this MUST fail (exit code != 0)
        execSync(`npx vitest run ${target.testSuite}`, {
          stdio: 'pipe',
          timeout: 60000,
        });

        // If we reach here, tests unexpectedly PASSED despite broken authorization!
        testFailedAsExpected = false;
      } catch (err: any) {
        // Test suite exited with error code - this proves tests CAUGHT the unauthorized access!
        testFailedAsExpected = true;
      }
    } finally {
      // ALWAYS restore original file content, regardless of test pass/fail
      fs.writeFileSync(target.filePath, originalContent, 'utf8');
      console.log('Restored original source file.');
    }

    if (testFailedAsExpected) {
      console.log(`Result: MUTATION KILLED (Security tests correctly detected the vulnerability)`);
      passedMutations++;
    } else {
      console.error(`CRITICAL FAILURE: MUTATION SURVIVED (Tests passed even with authorization disabled!)`);
      failedMutations++;
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log(` MUTATION TESTING SUMMARY: ${passedMutations} Killed, ${failedMutations} Survived`);
  console.log('='.repeat(80));

  if (failedMutations > 0) {
    console.error('\nFAIL: One or more mutations survived! Security test coverage is insufficient.');
    process.exit(1);
  } else {
    console.log('\nSUCCESS: All mutations were caught and killed by the security test suites.');
    process.exit(0);
  }
}

runMutationTests();
