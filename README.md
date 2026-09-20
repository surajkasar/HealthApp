# FuelLog — Diet Tracker

Phone-first food diary (MyFitnessPal-style): meals, macros, barcode scan, analytics, weight tracking.

**Requires Supabase** (no local demo). Setup: [SUPABASE.md](SUPABASE.md) · Deploy: [DEPLOY.md](DEPLOY.md)

## Stack

- Angular 19 + TypeScript + Tailwind
- Supabase Auth + Postgres + RLS
- Open Food Facts + USDA + Indian presets
- Chart.js · html5-qrcode · date-fns (`Asia/Kolkata`)
- Host: Vercel

## Quick start

1. Configure Supabase (migrations + keys) — [SUPABASE.md](SUPABASE.md)  
2. `npm install && npm start`  
3. Open http://localhost:4200 and create an account  

## Features

Diary · goals · search (OFF/USDA/Indian) · barcode/QR · recents/favorites · templates · quick add · custom foods · fiber/sugar/sodium · analytics · weight · streaks  

## License note

Product data from [Open Food Facts](https://world.openfoodfacts.org/) — attribute when shipping publicly. USDA FoodData Central for generic foods.
