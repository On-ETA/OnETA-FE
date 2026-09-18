# Web Fonts

These fonts are copied from `public/fonts` into the web build, so visitors do not need to have them
installed on their device. `src/theme/fonts.css` registers the existing `SUIT`
and `Pretendard` family names. Static font files preserve the weights used by the
app across browsers: SUIT 400/500/600/700/800 and Pretendard 500/600.

- `SUIT-*.woff2`: SUIT v2.0.5 from
  https://github.com/sun-typeface/SUIT/tree/v2.0.5/fonts/static/woff2
- `Pretendard-*.woff2`: Pretendard v1.3.9 from
  https://github.com/orioncactus/pretendard/tree/v1.3.9/packages/pretendard/dist/web/static/woff2

Both fonts use the SIL Open Font License 1.1. The unmodified licenses are included
as `SUIT-LICENSE.txt` and `Pretendard-LICENSE.txt`.

This CSS applies to browsers only. Native Android/iOS builds need a separate
native font registration setup.
