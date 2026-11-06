/** Color that carries meaning. A component takes the tones it can show and also states the meaning in words. */
export type Tone = 'neutral' | 'primary' | 'positive' | 'caution' | 'critical';
/** The tones one component takes. A value that isn't a `Tone` fails to compile. */
export type ToneSubset<T extends Tone> = T;
/** A status: SummaryCard's `status`, and the `ld-status-*` classes. */
export type StatusTone = ToneSubset<'neutral' | 'positive' | 'caution' | 'critical'>;
