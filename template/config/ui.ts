// The look of the React UI. The screens come from @strutvane/ui (behaviour only); the design
// package {{DESIGN_PACKAGE}} gives them their colours, fonts, layout shell and component styles.
//
// Switch design later with one command (it swaps the package and updates this file):
//   node strut design:use <crisp|vivid>
//
// Your own brand colour, font or corner radius? Do not edit the design package: put overrides in
// resources/ui/theme.css. That file is yours, so it stays when you switch or upgrade the design.
export default {
  design: '{{DESIGN}}',
  /** light, dark or system (each user can still switch in the app). */
  appearance: 'system',
  /** UI languages; add more any time (translations live in resources/ui/lang). */
  languages: ['en'],
}
