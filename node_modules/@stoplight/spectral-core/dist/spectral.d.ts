import { IDocument, IParsedResult } from './document';
import { RunnerRuntime } from './runner';
import { IConstructorOpts, IRunOpts, ISpectralDiagnostic, ISpectralFullResult } from './types';
import { Ruleset } from './ruleset/ruleset';
import { RulesetDefinition } from './ruleset/types';
export * from './types';
export declare class Spectral {
    protected readonly opts?: IConstructorOpts | undefined;
    private readonly _resolver;
    ruleset?: Ruleset;
    protected readonly runtime: RunnerRuntime;
    private readonly _computeFingerprint;
    constructor(opts?: IConstructorOpts | undefined);
    protected parseDocument(target: IParsedResult | IDocument | Record<string, unknown> | string): IDocument;
    runWithResolved(target: IParsedResult | IDocument | Record<string, unknown> | string, opts?: IRunOpts): Promise<ISpectralFullResult>;
    run(target: IParsedResult | IDocument | Record<string, unknown> | string, opts?: IRunOpts): Promise<ISpectralDiagnostic[]>;
    setRuleset(ruleset: RulesetDefinition | Ruleset): void;
    private _generateUnrecognizedFormatError;
    private _filterParserErrors;
}
