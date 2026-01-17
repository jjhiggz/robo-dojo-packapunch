import { config } from 'dotenv'
config() // Load .env first

import { faker } from '@faker-js/faker'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { songs } from '../src/db/schema'

// Parse command line arguments
const parseArgs = () => {
  const args = process.argv.slice(2)
  let count = 100 // default
  let archived = 0 // default number of archived songs
  
  for (const arg of args) {
    if (arg.startsWith('--count=')) {
      const value = parseInt(arg.split('=')[1], 10)
      if (!isNaN(value) && value > 0) {
        count = value
      }
    }
    if (arg.startsWith('--archived=')) {
      const value = parseInt(arg.split('=')[1], 10)
      if (!isNaN(value) && value >= 0) {
        archived = value
      }
    }
  }
  
  return { count, archived }
}

const { count: SONG_COUNT, archived: ARCHIVED_COUNT } = parseArgs()

// Realistic genres for music submissions
const GENRES = [
  'Hip Hop', 'R&B', 'Pop', 'Rock', 'Electronic', 'EDM', 'House', 'Techno',
  'Indie', 'Alternative', 'Jazz', 'Soul', 'Funk', 'Reggae', 'Latin',
  'Country', 'Folk', 'Metal', 'Punk', 'Trap', 'Lo-Fi', 'Drill', 'Afrobeats',
  'K-Pop', 'Dancehall', 'Ambient', 'Classical', 'Blues', 'Gospel'
]

// Sample notes that artists might leave
const SAMPLE_NOTES = [
  'New single dropping next month! Would love feedback 🔥',
  'Produced this in my bedroom studio',
  'Collab with my homie, we worked hard on this one',
  'First track off my upcoming EP',
  'Tried something different with this one, lmk what you think',
  'Been working on this for 6 months',
  'My best work yet honestly',
  'Inspired by 90s hip hop vibes',
  'This one is personal to me',
  'Made this at 3am lol',
  'Would love to hear your honest opinion',
  'Debut single! Thanks for listening',
  'Mixed and mastered by me',
  'Summer anthem vibes ☀️',
  'Dark and moody, perfect for late night drives',
  null, null, null, null, null, // Include nulls for variety
]

// Sample chat usernames
const CHAT_NAME_PREFIXES = [
  'xX', 'DJ', 'MC', 'Lil', 'Big', 'The', 'Mr', 'Ms', 'Sir', 'Lord', 'King', 'Queen', ''
]
const CHAT_NAME_SUFFIXES = [
  'Xx', '_music', '_beats', '808', 'productions', '_official', '420', '69', 'Gaming', 'TV', ''
]

// Generate a realistic chat username
const generateNameInChat = (): string | null => {
  if (Math.random() > 0.85) return null // 15% have no chat name
  
  const style = Math.random()
  
  if (style < 0.3) {
    // Simple first name style
    return faker.person.firstName()
  } else if (style < 0.5) {
    // Username with numbers
    return `${faker.internet.username()}${faker.number.int({ min: 1, max: 99 })}`
  } else if (style < 0.7) {
    // Prefix + word style
    const prefix = CHAT_NAME_PREFIXES[Math.floor(Math.random() * CHAT_NAME_PREFIXES.length)]
    const word = faker.word.adjective()
    const suffix = CHAT_NAME_SUFFIXES[Math.floor(Math.random() * CHAT_NAME_SUFFIXES.length)]
    return `${prefix}${word}${suffix}`.slice(0, 20)
  } else {
    // Simple username
    return faker.internet.username().slice(0, 20)
  }
}

// Helper to generate a slug from artist name
const toSlug = (name: string): string =>
  name.toLowerCase().replace(/[^a-z0-9]+/g, '').slice(0, 20)

// Generate a random YouTube URL
const generateYoutubeUrl = (artist: string): string | null => {
  if (Math.random() > 0.6) return null // 40% chance of having YouTube
  const videoId = faker.string.alphanumeric(11)
  return Math.random() > 0.5
    ? `https://youtube.com/watch?v=${videoId}`
    : `https://youtu.be/${videoId}`
}

// Generate a random SoundCloud URL
const generateSoundcloudUrl = (artist: string): string | null => {
  if (Math.random() > 0.5) return null // 50% chance of having SoundCloud
  const slug = toSlug(artist)
  const trackSlug = faker.lorem.slug(3)
  return `https://soundcloud.com/${slug}/${trackSlug}`
}

// Generate a random Spotify URL
const generateSpotifyUrl = (): string | null => {
  if (Math.random() > 0.4) return null // 60% chance of having Spotify
  const trackId = faker.string.alphanumeric(22)
  return `https://open.spotify.com/track/${trackId}`
}

// Generate a random Instagram URL
const generateInstagramUrl = (artist: string): string | null => {
  if (Math.random() > 0.65) return null // 35% chance of having Instagram
  const slug = toSlug(artist)
  const suffix = Math.random() > 0.7 ? `_music` : Math.random() > 0.5 ? `official` : ''
  return `https://instagram.com/${slug}${suffix}`
}

// Generate a random TikTok URL
const generateTiktokUrl = (artist: string): string | null => {
  if (Math.random() > 0.55) return null // 45% chance of having TikTok
  const slug = toSlug(artist)
  const suffix = Math.random() > 0.6 ? `_` : ''
  return `https://tiktok.com/@${slug}${suffix}`
}

// Generate a random Facebook URL
const generateFacebookUrl = (artist: string): string | null => {
  if (Math.random() > 0.25) return null // 75% chance - few artists use FB
  const slug = toSlug(artist)
  return `https://facebook.com/${slug}music`
}

// Generate the main song link (could be any platform)
const generateSongLink = (artist: string): string | null => {
  if (Math.random() > 0.85) return null // 15% chance of no song link
  
  const slug = toSlug(artist)
  const rand = Math.random()
  
  if (rand < 0.35) {
    // YouTube link
    const videoId = faker.string.alphanumeric(11)
    return `https://youtube.com/watch?v=${videoId}`
  } else if (rand < 0.65) {
    // SoundCloud link
    const trackSlug = faker.lorem.slug(3)
    return `https://soundcloud.com/${slug}/${trackSlug}`
  } else if (rand < 0.85) {
    // Spotify link
    const trackId = faker.string.alphanumeric(22)
    return `https://open.spotify.com/track/${trackId}`
  } else {
    // Bandcamp or other
    return `https://${slug}.bandcamp.com/track/${faker.lorem.slug(2)}`
  }
}

// Generate 1-3 random genres
const generateGenres = (): string | null => {
  if (Math.random() > 0.9) return null // 10% chance of no genres
  
  const count = faker.number.int({ min: 1, max: 3 })
  const shuffled = [...GENRES].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count).join(', ')
}

// Pick a random note (or null)
const getRandomNote = (): string | null => {
  return SAMPLE_NOTES[Math.floor(Math.random() * SAMPLE_NOTES.length)] ?? null
}

// Generate banana stickers - only 5-8 songs should have bananas
// We'll handle this differently: most get 0, a few get some
const generateBananaStickers = (): number => {
  // ~6% chance to have bananas (gives roughly 5-8 out of 100)
  if (Math.random() > 0.06) return 0
  
  // If they have bananas, give them 1-5
  const rand = Math.random()
  if (rand < 0.5) return 1
  if (rand < 0.75) return 2
  if (rand < 0.9) return 3
  return faker.number.int({ min: 4, max: 5 })
}

async function seed() {
  const databaseUrl = process.env.DATABASE_URL
  if (!databaseUrl) {
    throw new Error('DATABASE_URL environment variable is not set')
  }

  const pool = new Pool({ connectionString: databaseUrl })
  const db = drizzle(pool)

  console.log(`\n🌱 Seeding database with realistic data...`)
  console.log(`   Queue songs: ${SONG_COUNT}`)
  console.log(`   Archived songs: ${ARCHIVED_COUNT}`)

  // Clear existing songs
  await db.delete(songs)
  console.log('✓ Cleared existing songs')

  // Generate fake songs for the queue (not archived)
  const fakeSongs = Array.from({ length: SONG_COUNT }, () => {
    const artist = faker.music.artist()
    
    return {
      title: faker.music.songName(),
      artist,
      nameInChat: generateNameInChat(),
      notes: getRandomNote(),
      genres: generateGenres(),
      songLink: generateSongLink(artist),
      youtubeUrl: generateYoutubeUrl(artist),
      soundcloudUrl: generateSoundcloudUrl(artist),
      instagramUrl: generateInstagramUrl(artist),
      tiktokUrl: generateTiktokUrl(artist),
      facebookUrl: generateFacebookUrl(artist),
      spotifyUrl: generateSpotifyUrl(),
      status: 'pending' as const,
      points: faker.number.int({ min: 1, max: 15 }),
      bananaStickers: generateBananaStickers(),
      submittedAt: faker.date.recent({ days: 14 }),
      archivedAt: null,
    }
  })

  // Generate archived/pinned songs
  const archivedSongs = Array.from({ length: ARCHIVED_COUNT }, (_, i) => {
    const artist = faker.music.artist()
    // Archived songs are spaced out over the past few hours
    const hoursAgo = ARCHIVED_COUNT - i // most recent = smallest index
    
    return {
      title: faker.music.songName(),
      artist,
      nameInChat: generateNameInChat(),
      notes: getRandomNote(),
      genres: generateGenres(),
      songLink: generateSongLink(artist),
      youtubeUrl: generateYoutubeUrl(artist),
      soundcloudUrl: generateSoundcloudUrl(artist),
      instagramUrl: generateInstagramUrl(artist),
      tiktokUrl: generateTiktokUrl(artist),
      facebookUrl: generateFacebookUrl(artist),
      spotifyUrl: generateSpotifyUrl(),
      status: 'pending' as const,
      points: faker.number.int({ min: 1, max: 15 }),
      bananaStickers: faker.number.int({ min: 0, max: 3 }),
      submittedAt: faker.date.recent({ days: 14 }),
      archivedAt: new Date(Date.now() - hoursAgo * 60 * 60 * 1000), // stagger by hours
    }
  })

  const allSongs = [...fakeSongs, ...archivedSongs]

  // Log some stats
  const withSongLink = allSongs.filter(s => s.songLink).length
  const withYoutube = allSongs.filter(s => s.youtubeUrl).length
  const withSoundcloud = allSongs.filter(s => s.soundcloudUrl).length
  const withInstagram = allSongs.filter(s => s.instagramUrl).length
  const withTiktok = allSongs.filter(s => s.tiktokUrl).length
  const withSpotify = allSongs.filter(s => s.spotifyUrl).length
  const withNotes = allSongs.filter(s => s.notes).length
  const withGenres = allSongs.filter(s => s.genres).length
  const withNameInChat = allSongs.filter(s => s.nameInChat).length
  const withBananas = allSongs.filter(s => s.bananaStickers > 0).length
  const totalBananas = allSongs.reduce((sum, s) => sum + s.bananaStickers, 0)
  const totalSongs = allSongs.length
  
  console.log('\n📊 Data distribution:')
  console.log(`   Song links: ${withSongLink}/${totalSongs}`)
  console.log(`   YouTube: ${withYoutube}/${totalSongs}`)
  console.log(`   SoundCloud: ${withSoundcloud}/${totalSongs}`)
  console.log(`   Instagram: ${withInstagram}/${totalSongs}`)
  console.log(`   TikTok: ${withTiktok}/${totalSongs}`)
  console.log(`   Spotify: ${withSpotify}/${totalSongs}`)
  console.log(`   Notes: ${withNotes}/${totalSongs}`)
  console.log(`   Genres: ${withGenres}/${totalSongs}`)
  console.log(`   Chat names: ${withNameInChat}/${totalSongs}`)
  console.log(`   🍌 Bananas: ${withBananas} songs (${totalBananas} total stickers)\n`)

  // Insert in batches
  const batchSize = 25
  for (let i = 0; i < allSongs.length; i += batchSize) {
    const batch = allSongs.slice(i, i + batchSize)
    await db.insert(songs).values(batch)
    console.log(`✓ Inserted songs ${i + 1} - ${Math.min(i + batchSize, allSongs.length)}`)
  }

  console.log(`\n🎵 Successfully seeded ${SONG_COUNT} queue songs + ${ARCHIVED_COUNT} archived songs!`)
  console.log(`\n💡 Usage: npm run db:seed -- --count=N --archived=M`)
  console.log(`   --count=N    Number of songs in queue (default: 100)`)
  console.log(`   --archived=M Number of archived/pinned songs (default: 0)`)
  
  await pool.end()
  process.exit(0)
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err)
  process.exit(1)
})
