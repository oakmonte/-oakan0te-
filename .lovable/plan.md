Update the hero "Content to Cart" video in `src/routes/index.tsx`:

1. Change the video container max-width from `180px` to `175px`.
2. Adjust the `<video>` cropping so the additional crop is taken from the right side while keeping the existing left crop at 5px. This will be done by increasing the total overflow width and maintaining the current `-ml-[5px]` offset.
3. Preserve the 30px corner radius, autoplay/loop/muted behavior, and background blending.

```text
Before:
  max-w-[180px]
  className="w-[calc(100%+12px)] h-full object-cover -ml-[5px]"

After (example):
  max-w-[175px]
  className="w-[calc(100%+16px)] h-full object-cover -ml-[5px]"
  (adds 4px more crop from the right, for 5px left / 11px right total)
```

If you want a different right-crop amount, let me know the exact pixel value.