# 1.1.4
- Fixed glitch with Date scales.

# 1.1.3
- Removed stray `d3-delaunay` dependency from package.

# 1.1.2
- `registerMoveListener` is now optional, for advanced use cases.

# 1.1.1
- Fix publish.

# 1.1.0
- Now exports `useTransform` which can be used to transform groups of elements.
- `usePanZoom` now accepts two new optional boolean options: `lockXAxis` and `lockYAxis`. 
- Improve typescript support for Date scales. `IScale` domain can now extend `Date`.

# 1.0.4
- Republish

# 1.0.3
Improve readme.

# 1.0.2
Fix a bug where if you put down another pointer outside of the chart while a gesture is active, it would corrupt the gesture.

# 1.0.1
Improve user experience by ignoring event calls when no gesture is in progress.

# 1.0.0
- Initial version.
