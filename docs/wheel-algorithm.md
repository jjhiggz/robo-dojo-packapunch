# Spin Wheel Algorithm

This document explains how the spin wheel algorithm works for selecting songs.

## Overview

The wheel uses a **dual-section design** when banana stickers exist:

1. **Banana Section (50% of wheel)** - Only songs with banana stickers
2. **Points Section (50% of wheel)** - ALL songs (including banana songs)

When no songs have banana stickers, the entire wheel (100%) is the points section.

## The Algorithm

### Step 1: Section Selection

When spinning, we first determine which section to pick from:

- If banana songs exist: **50% chance** for banana section, **50% chance** for points section
- If no banana songs: 100% points section

### Step 2: Winner Selection Within Section

**Banana Section** (weighted by banana sticker COUNT):
- Each song's chance = `songBananas / totalBananas`
- Points are ignored in this section
- More banana stickers = higher chance

**Points Section** (weighted by points):
- Each song's chance = `songPoints / totalPoints`
- Banana stickers are ignored in this section
- More points = higher chance

## Example Calculation

Given 100 songs:
- Song 1: 1 banana sticker, 10 points
- Song 2: 2 banana stickers, 15 points  
- Song 3: 3 banana stickers, 10 points
- Songs 4-100: 0 banana stickers, 970 combined points

**Totals:**
- Total banana stickers: 1 + 2 + 3 = 6
- Total points: 10 + 15 + 10 + 970 = 1,005

### Banana Section Calculation (50% of wheel, only banana songs)

| Song | Bananas | Calculation | Share of Banana Section | Share of Total |
|------|---------|-------------|------------------------|----------------|
| Song 1 | 1 | 1/6 × 50% | 8.33% | 8.33% |
| Song 2 | 2 | 2/6 × 50% | 16.67% | 16.67% |
| Song 3 | 3 | 3/6 × 50% | 25% | 25% |

### Points Section Calculation (50% of wheel, ALL songs)

| Song | Points | Calculation | Share of Points Section | Share of Total |
|------|--------|-------------|------------------------|----------------|
| Song 1 | 10 | 10/1005 × 50% | 0.995% | 0.497% |
| Song 2 | 15 | 15/1005 × 50% | 1.493% | 0.746% |
| Song 3 | 10 | 10/1005 × 50% | 0.995% | 0.497% |
| Song 4-100 | 10 each | 10/1005 × 50% | 0.995% each | 0.497% each |

### Final Probabilities

| Song | Banana Chance | Points Chance | **Total Chance** |
|------|---------------|---------------|------------------|
| Song 1 | 8.33% | 0.50% | **8.83%** |
| Song 2 | 16.67% | 0.75% | **17.42%** |
| Song 3 | 25.00% | 0.50% | **25.50%** |
| Song 4-100 | 0% | 0.50% each | **0.50% each** |

## Key Points

1. **Banana stickers boost probability significantly** - Having just 1 banana sticker gives you access to 50% of the wheel, shared only with other banana songs.

2. **Points still matter** - Songs with banana stickers also compete in the points section, giving them two chances to win.

3. **Non-banana songs only compete for 50%** - When banana songs exist, non-banana songs can only win from the points section.

4. **More bananas = more chance** - Within the banana section, songs are weighted by their banana sticker COUNT, not points.

5. **More points = more chance** - Within the points section, songs are weighted by their points, not bananas.

## Visual Representation

```
┌────────────────────────────────────┐
│                                    │
│   🍌 BANANA SECTION (180°)         │
│   ─────────────────────────        │
│   • Only songs with bananas        │
│   • Weighted by banana COUNT       │
│   • 50% chance to land here        │
│                                    │
├────────────────────────────────────┤
│                                    │
│   📊 POINTS SECTION (180°)         │
│   ─────────────────────────        │
│   • ALL songs (incl. banana)       │
│   • Weighted by POINTS             │
│   • 50% chance to land here        │
│                                    │
└────────────────────────────────────┘
```

## Code Location

The algorithm is implemented in:
- `src/lib/wheel-algorithm.ts` - Core algorithm functions
- `src/lib/wheel-algorithm.test.ts` - Comprehensive test suite
- `src/components/SpinWheel.tsx` - React component using the algorithm

## Testing

Run tests with:
```bash
bun test
```

The test suite includes:
- Unit tests for each function
- Statistical distribution tests (10,000 iterations)
- Edge case handling
- Probability calculation verification

