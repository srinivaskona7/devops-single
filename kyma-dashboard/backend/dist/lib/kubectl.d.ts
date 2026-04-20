import { type ChildProcess } from 'node:child_process';
export declare function kubectlCacheGet(key: string, ttlMs: number): any | null;
export declare function kubectlCacheSet(key: string, data: any): void;
export declare const paths: {
    readonly PROJECT_ROOT: string;
    readonly GEN_DIR: string;
    readonly CLUSTERS_DIR: string;
    readonly TOKEN_KUBECONFIG: string;
    readonly GEN_TOKEN_KUBECONFIG: string;
    readonly OIDC_KUBECONFIG: string;
    readonly OIDC_KUBECONFIG2: string;
};
export declare function getActiveKubeconfig(): string | null;
export declare function setActiveKubeconfig(p: string | null): void;
export declare function getKubeconfigPath(): string;
export declare function getKubectlEnv(): NodeJS.ProcessEnv;
/** Run kubectl with -o json and parse result. Synchronous. */
export declare function kubectlJson<T = any>(args: string[], timeoutMs?: number): {
    data: T | null;
    error: string | null;
    notFound: boolean;
};
/** Run kubectl with -o json and parse result. Async — does NOT block event loop.
 *  Deduplicates concurrent identical calls (returns same Promise). */
export declare function kubectlJsonAsync<T = any>(args: string[], timeoutMs?: number, cacheTtlMs?: number): Promise<{
    data: T | null;
    error: string | null;
    notFound: boolean;
}>;
/** Run kubectl and return raw stdout. Async — does NOT block event loop. */
export declare function kubectlRawAsync(args: string[], timeoutMs?: number): Promise<{
    stdout: string;
    stderr: string;
    ok: boolean;
}>;
/** Run kubectl and return raw stdout. Synchronous. */
export declare function kubectlRaw(args: string[], timeoutMs?: number): {
    stdout: string;
    stderr: string;
    ok: boolean;
};
/** Run kubectl with full control: returns { stdout, stderr, returncode }. */
export declare function kubectlExec(args: string[], timeoutMs?: number, input?: string): {
    stdout: string;
    stderr: string;
    returncode: number;
};
/** Spawn a streaming child process. */
export declare function spawnStream(command: string, args: string[], extraEnv?: NodeJS.ProcessEnv, cwd?: string): ChildProcess;
/** Convert ISO timestamp to human-readable age string. */
export declare function calcAge(ts?: string | null): string;
/** Find btp CLI in PATH or known locations. */
export declare function findBtp(): string;
//# sourceMappingURL=kubectl.d.ts.map