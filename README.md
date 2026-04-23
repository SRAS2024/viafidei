# viafideiVia Fidei
A Catholic web platform and app focused on clarity, beauty, reverence, trustworthiness, and depth. Via Fidei is designed to feel liturgical, modern, minimalist, and deeply intuitive, while remaining technically rigorous, modular, secure, and production ready. This README revises and expands the original project brief into a full implementation blueprint for a highly polished, enterprise grade build. The original core requirements for the platform, including content domains, profile features, milestones, search, localization, visual direction, and content structure, are incorporated here.
Canonical Domain
Production canonical domain: https://viafidei.com
All environments, SEO rules, metadata, sitemap generation, Open Graph configuration, canonical tags, and robots directives should treat viafidei.com as the single canonical production domain.
Project Vision
Via Fidei exists to provide a deeply beautiful, theologically trustworthy, multilingual Catholic experience for both newcomers and lifelong Catholics. It should feel prayerful and refined without becoming ornate, and advanced without becoming cluttered.
The product should be:
Classy, symmetrical, and elegant.
Black and white at its core, with restrained sacred color accents.
Fast, accessible, secure, and highly modular.
Rich in trustworthy Catholic content.
Personal and private, not social.
Beautiful enough to inspire confidence and calm.
Structured to scale cleanly across web, mobile, and administrative workflows.
Design Inspiration
The visual inspiration is the uploaded Augustine Journal concept, but this implementation must not simply imitate it. It should taper, refine, and elevate that direction into a more liturgical, more modular, more canonical, and more product ready platform.
The finished design language should feel:
Centered and balanced.
Modern minimalist.
Sacred without being visually heavy.
Editorial, premium, and calm.
Structured with excellent whitespace, typography, and icon discipline.
Primary Product Goals
Offer a deeply curated Catholic reference and spiritual growth platform.
Support multilingual localization from the beginning.
Centralize prayers, sacramental guidance, saints, Marian apparitions, parish discovery, goals, milestones, journal entries, and search.
Maintain privacy by design.
Support a secure admin workflow with audit logging.
Use modular architecture that allows additional tabs, APIs, content types, and ingestion jobs to be added without restructuring the platform.
Periodically ingest and reconcile data from official Catholic and Vatican sources to keep the platform current and trustworthy.
Automatically present the site in the user’s device language through the same translation layer pattern used by the Augustine Journal codebase, while still allowing manual override when desired.
Provide an admin editing experience that mirrors the public homepage so administrators can manipulate the live page structure directly and see updates in real time before and upon save.
Non Goals
No social feed.
No public user walls.
No direct messaging.
No follower graph.
No timeline based engagement loops.
No gamified manipulative patterns.
No visual clutter.
Advanced Technical Direction
This project should use a highly sophisticated, modular, production grade stack with strong typing, clean boundaries, and security first practices.
Recommended Languages and Core Stack
Frontend
TypeScript
React
Next.js App Router
HTML5
CSS with Tailwind CSS and a strict design token system
Framer Motion for restrained micro interactions
Zod for runtime validation
TanStack Query for client side data orchestration where needed
A shared translation layer architecture aligned with the Augustine Journal implementation pattern, adapted for Via Fidei’s content model
Backend
TypeScript
Node.js
NestJS for modular backend architecture
REST API as primary interface
Optional GraphQL gateway only if future use cases justify it
Prisma ORM
PostgreSQL
Redis for caching, rate limiting, session support, queues, and scheduled jobs
BullMQ for background jobs, content sync, indexing, audit processing, translation workflows, and ingestion pipelines
Search
PostgreSQL full text search as baseline
Meilisearch or OpenSearch for scalable unified search
Language aware indexing and weighted entity ranking
Infrastructure
Railway for early deployment
Docker for reproducible environments
Multi stage Docker builds for web, API, admin, and worker services
Cloudinary for images
Postmark or SendGrid for email
Sentry for monitoring
Plausible or Google Analytics for privacy aware analytics
GitHub Actions for CI and CD
Security and Edge
Helmet middleware
Rate limiting backed by Redis
CSRF protection where required
Content Security Policy
Secure headers
Origin checks
Input validation across all boundaries
Argon2id for password hashing
JWT plus refresh token rotation or secure session cookies
Audit logging for admin actions
Architecture Overview
The platform should be built as a modular monorepo.
Recommended Monorepo Layout
viafidei/
  apps/
    web/
    api/
    admin/
    worker/
  packages/
    ui/
    config/
    types/
    auth/
    i18n/
    search/
    content/
    logger/
    database/
    validation/
    seo/
    media/
    scraping/
    translation/
    page-builder/
    realtime/
  prisma/
  docker/
  docs/
  scripts/
  public/
Responsibility of Each App
apps/web
Public facing website and authenticated user experience.
apps/api
Primary application API, auth, content delivery, profile operations, search endpoints, admin endpoints, webhook handlers.
apps/admin
Private administrative interface for content curation, moderation, metadata review, parish review, localization oversight, ingestion review, favicon management, homepage editing, and audit logs.
apps/worker
Background jobs for search indexing, content syncing, image processing, reminder jobs, overdue status updates, periodic ingestion, deduplication, translation jobs, and approved external source refreshes.
Docker and Containerization Blueprint
All deployable services should use multi stage Docker builds to minimize image size, improve reproducibility, and separate dependency installation from runtime execution.
Docker Requirements
Separate build and runtime stages for each app.
Production images must exclude development dependencies where possible.
Prisma client generation must occur during build in a predictable layer.
Final runtime images should use non root users where feasible.
Environment variables should be injected at deploy time, not baked into images.
Shared base images should be standardized across services.
Health checks should be exposed for web, API, admin, and worker.
Docker Compose may be used for local development with PostgreSQL and Redis.
The docker/ directory should contain reusable base Dockerfiles or templates for monorepo services.
Suggested Container Strategy
web image
api image
admin image
worker image
postgres service for local development
redis service for local development
Multi Stage Build Goals
Faster CI builds through layer caching.
Smaller production images.
Cleaner dependency boundaries.
Consistent behavior between local, staging, and production.
Safer and more professional deployment standards.
UI and Visual Blueprint
Brand Placement
The Via Fidei logo must appear top and center in the header experience. It should be liturgical in character, but expressed through a restrained modern minimalist system. Think sacred geometry, refined serif support, elegant spacing, and confidence through simplicity.
Header Blueprint
Centered logo at top.
Center aligned primary navigation beneath or around the logo depending on breakpoint.
Search and Login or Profile placed to the far right.
Perfectly balanced spacing left and right.
High typographic clarity and calm vertical rhythm.
Primary Navigation Order
Home
Prayers
Spiritual Life
Spiritual Guidance
Liturgy and History
Saints & Our Lady
Search
Login / Profile
Settings via dropdown when authenticated
Visual System
Core palette
Black
White
Soft stone grays
Liturgical blue as primary action accent
Red only for destructive actions
Gold only where sacred iconography benefits from it
Action semantics
Blue = save / continue / confirm non destructive progress
Gray = cancel / secondary action
Red = delete / remove / destructive action
Typography
Refined serif for headings or sacred display contexts
High legibility sans serif for body and UI
Large, elegant type scale
Excellent line length discipline
Strong contrast and accessibility
Layout
Symmetrical
Top to bottom, left to right logic
Spacious
Modular cards
Elegant section separators
Smooth responsive behavior
Iconography
Accurate Catholic iconography for sacraments
Devotion specific icons for consecrations
Marian icon color handling where appropriate
Saints and apparitions enriched with visual assets
Holy Family and other sacred references paired with correct image treatments where doctrinally and historically appropriate
Consistent icon stroke and size rules
Information Architecture
Public Sections
1. Home
Purpose: introduction, orientation, trust building, and first action.
Includes:
Mission statement
Brief overview of Catholicism
Quick links to sacraments, OCIA, Rosary, Confession, Parish Finder
Device language aware rendering by default
Featured prayers and beginner pathways
Featured saints or liturgical season modules
Gentle onboarding for newcomers
2. Prayers
Purpose: large prayer library with multilingual support.
Includes:
Thousands of approved Catholic prayers
Categories such as Marian, Christ centered, Angelic, Sacramental, Seasonal, Devotions, Daily
Prayer detail pages
Print friendly formatting
Add to My Prayers
Optional audio playback
Localized content by language and region
Search, filters, and favorites
3. Spiritual Life
Purpose: formation pathways and guided devotion.
Includes:
Rosary guide
Confession guide
Adoration guide
Consecration pathways
Step by step checklists
Book covers and reading plans
Vocations guidance
Add as Goal functionality
Overdue status logic for time based devotions
4. Spiritual Guidance
Purpose: help users find real world Catholic support.
Includes:
Parish index
Auto location or manual search
Parish cards with address, phone, email, hours, website, diocese, OCIA or RCIA link
Map and list modes
Save parish to profile
Localization aware search and formatting
5. Liturgy and History
Purpose: formation through structure, symbolism, and historical continuity.
Includes:
Order of the Mass
Liturgical year
Rites including marriage, funerals, ordinations
Timelines of councils
Symbol glossary
Art and icon support where appropriate
6. Saints & Our Lady
Purpose: hagiography, Marian devotion, patronage reference, prayer access.
Includes:
Canonized saints dataset
Approved Marian apparitions dataset
Entry pages with biography, feast day, patronages, official prayers, canonical details, apparition details
Save to profile
Prevent duplicate saves
Rich visual cards
Correct photos or approved artwork where available, including saint portraits, apparition imagery, Marian art, Holy Family art, and other sacred media associations sourced from approved repositories or curated media workflows
7. Search
Purpose: one unified global search system across all major entities.
Includes:
Always visible access
Typeahead suggestions
Grouped results by entity type
Language filters
Highlighted matches
Weighted ranking
Keyboard accessible interactions
Authenticated User Experience
Profile
The profile should be personal, elegant, and highly organized.
My Prayers
Saved prayers
Individual removal
Confirmation modal with dynamic prayer name
Journal
Private journal entries
Title and body
Save and Cancel actions
Edit and Delete controls
Favorite entry toggle
Confirmation modal for deletion
Full timestamps and update history support
Milestones
Three tiers should be visually distinct and hierarchically ordered.
Tier 1: Sacraments
Always pinned at top
Add through plus action
Seven sacraments with accurate icons
No duplicates allowed
Tier 2: Spiritual Milestones
Consecrations
Retreats
Major devotional completions
No duplicates allowed
Completed goals may promote into this section automatically when applicable
Tier 3: Personal Milestones
User created achievements
Checklist based accomplishments
Promoted from completed goals
Editable metadata
My Goals
Templates for novenas, OCIA, consecrations, fasts, and devotional plans
Custom goals with title, description, date range, and checklist
Completion promotes to milestone where applicable
Due date logic with overdue support
Overdue goals remain completable
Saints & Our Lady
Saved entries display image and prayer
Duplicate prevention
Removal confirmation modal with dynamic entity name
Settings
Theme control
Language override
Privacy summary
Profile picture editing
Notification preferences if implemented later
Session management
Authentication Blueprint
Required Flows
Register
Login
Logout
Forgot password
Password reset
Secure session refresh
Email verification, if desired for account integrity
Create Account Form
Fields:
First Name
Last Name
Email
Password
Re enter Password
Show or hide password toggle
Create Account CTA
Login Form
Fields:
Email
Password
Forgot password link
Link to Create Account
Security Rules
Passwords hashed with Argon2id
Strong password policy
Token expiration rules
Reset links signed and time limited
Rate limiting on auth endpoints
Device or session awareness if added later
Audit log entries for auth sensitive actions
Admin System Blueprint
The admin layer should be fully modular and protected.
Admin Authentication
Admin username and password must be sourced from environment variables. These credentials must never be hardcoded, committed, logged, or exposed to the client.
Admin Responsibilities
Manage prayers
Manage saints
Manage Marian apparitions
Manage parish entries
Manage liturgical content
Manage translations and localization coverage
Review ingestion jobs
Reindex search
Review audit logs
Review image associations
Control publishing states
Manage canonical metadata and structured data
Edit the homepage through a mirrored live admin interface
Upload and manage the site favicon
Admin Homepage Mirror Requirement
The admin homepage should be a mirror of the Via Fidei public homepage. This page should act as the primary visual page editing surface for administrators.
Requirements:
The admin should see the same structural layout as the public homepage.
Editable regions should map directly to the public content blocks.
Changes should be previewed in real time while editing.
When the admin selects Save Page, the persisted changes should be reflected immediately in the preview state and then propagated to the live site according to publishing rules.
Real time update channels should be used for the editing session so block updates, copy changes, image changes, and layout settings can be reflected instantly.
The editing model should be block based and modular, not hardcoded page strings.
Every save action should write an audit record with timing metadata and changed fields.
Draft and published versions should be supported so the admin can distinguish between preview state and public state where needed.
Favicon Management Requirement
The admin site must include a favicon upload and management feature.
Requirements:
Admin can upload a favicon image through the admin interface.
The favicon asset must be stored in the database with metadata and linked media storage as needed.
The favicon should be used everywhere it is expected across the platform, including standard browser favicon references, app icons where applicable, manifest references, and any other reasonably expected favicon slots.
The system should generate or register the necessary sizes and variants when possible.
Changes to the favicon should propagate to public metadata and cached assets in a controlled way.
All favicon changes must be logged in the admin audit trail.
Admin Audit Logging
Every meaningful admin action must be recorded in PostgreSQL with:
Actor identity
Action type
Target entity type
Target entity id
Changed fields
Previous value snapshot where feasible
New value snapshot where feasible
Timestamp
Source IP if collected lawfully
User agent
Request id or trace id
All user data and all admin changes, along with timing data and relevant audit metadata, must be persisted to PostgreSQL according to the outlined requirements.
Content Ingestion, Official Catholic Scraping, and Periodic Sync
The platform should periodically ingest structured content from approved official Catholic and Vatican sources. This must be implemented as a disciplined ingestion system, not an indiscriminate crawler.
Guiding Principle
The system should periodically scrape or ingest data from approved, lawful, structured, and rate limited official Catholic sources to enrich tabs such as parishes, liturgical calendars, saints metadata, approved apparitions metadata, Vatican resources, documents, feast data, and translation resources.
Approved Source Categories
Vatican websites and official Vatican feeds where available
Vatican APIs or structured resources where available
Official diocesan or episcopal conference sites where appropriate
Official Catholic parish directories where lawful and permitted
Other official Catholic sites with clear permission, public data, or structured endpoints
Approved internal curated source lists managed by admin
Ingestion Rules
Respect terms of service.
Respect robots and legal boundaries where applicable.
Prefer official APIs over HTML scraping.
Store source attribution and sync metadata.
Validate and normalize all external payloads.
Never overwrite curated editorial content blindly.
Use review queues for uncertain merges.
Cache aggressively.
Apply retry backoff.
Log sync durations, success rates, failures, and diffs.
Record source fingerprints and canonical external ids.
Deduplicate by canonical slug, official source id, normalized name, feast date, locale, and content hashes where appropriate.
Per Tab Ingestion Goals
Home
Liturgical season highlights
Featured Vatican or official Catholic calendar data
Curated daily or seasonal prayer visibility
Prayers
Approved prayer texts from curated editorial database
Translation enrichment where allowed and reviewed
Prayer category normalization
Spiritual Life
Curated guides
Optional liturgical season based devotional visibility
Official references linked to Church teaching
Spiritual Guidance
Parish ingestion from approved official directories
Canonical location reconciliation
Diocese and OCIA metadata enrichment
Liturgy and History
Vatican and official Catholic source references
Liturgical calendar sync
Councils, rites, and historical references from curated datasets
Saints & Our Lady
Saint and apparition metadata enrichment
Canonical dates, titles, patronage, feast day, and official prayer linkage
Media matching for saint portraits, Marian art, Holy Family, and related sacred images where approved and correctly attributed
Media Matching and Correct Photos
The system should attempt to attach the correct photo or approved artwork next to saints, Marian apparitions, Our Lady entries, the Holy Family, and other sacred subjects where possible.
Rules:
Prefer approved or official media repositories.
Store attribution, source URL, license metadata, and review status.
Use admin review for ambiguous matches.
Maintain a media confidence score.
Prevent duplicate image associations.
Distinguish between historical portrait, devotional iconography, statue, painting, and apparition artwork.
Allow fallback to curated placeholder art where no approved image exists.
Duplicate Prevention Strategy
Duplicate prevention must be first class.
Use:
Canonical external ids
Normalized entity names
Locale aware slug uniqueness
Composite unique constraints in Prisma
Fuzzy matching review queues for ingestion collisions
Content hash comparison
Media fingerprint comparison
Source level dedupe tables
Worker Scheduling
Use BullMQ plus Redis with repeatable jobs. Schedule frequencies should be environment configurable.
Example:
Every 15 minutes for lightweight metadata checks
Hourly for search sync or low cost content refresh
Daily for major dataset refresh
Weekly for deep reconciliation and image verification
Translation and Localization Layer
Via Fidei must use the same translation layer pattern as the Augustine Journal repository, adapted to Via Fidei’s richer content system.
Translation Requirements
Device language should be detected automatically on first visit.
The website does not need to force a visible language setting for basic use.
The site should auto render in the user’s device language when supported.
Manual language override should still be available in settings.
Translations should be cached and versioned.
Doctrinally sensitive content should support human reviewed translations.
UI text and content text must be separable in the translation architecture.
Locale fallback chains must be deterministic.
Translation Flow
Detect browser or device locale.
Match locale to supported language.
Serve existing curated translation if available.
If missing and permitted, use the configured translation API through the Augustine Journal style translation layer.
Store translation result with provenance and review status.
Reuse cached translation for future requests.
Allow admin override or correction.
Translation Safety Rules
Machine translation must never silently overwrite reviewed content.
Core doctrinal texts should be flagged for human review.
Every translated content record should store:
Source locale
Target locale
Translation engine
Review status
Last translated timestamp
Content checksum
Admin should be able to lock translations from regeneration.
Rate Limiting Strategy
A robust rate limiting layer is required across public, authenticated, admin, and scraping related endpoints.
Technology
Redis backed distributed rate limiting
NestJS rate limit guards
Reverse proxy or edge throttling where available
Per route policy definition
Example Policies
Public read endpoints
120 requests per minute per IP for general content
Search endpoints more restrictive, for example 30 requests per minute per IP
Typeahead endpoints short burst tolerant, but protected
Authentication
Login: 5 attempts per 15 minutes per IP and email tuple
Password reset request: 3 requests per hour per account
Registration: 5 per hour per IP
Authenticated write actions
Journal save: 30 per minute per user
Favorites and saves: 60 per minute per user
Goal and milestone mutations: 20 per minute per user
Admin
Very restrictive
Strong session verification
Action logging on every mutation
Optional IP allow list for production
Scraping and ingestion jobs
Per source rate limits configured independently
Global ingestion concurrency caps
Host aware retry windows
Circuit breaker behavior for unstable sources
Backoff scheduling for repeated failures
Abuse Controls
Soft blocks
Hard blocks for repeat abuse
Exponential backoff
Suspicious request scoring
Bot detection support if traffic warrants it
Search query throttling
Queue protection for ingestion endpoints and webhooks
Security Requirements
Required Middleware and Protections
Helmet must be enabled in production with carefully configured policies.
Strict Content Security Policy.
HSTS for production.
X Content Type Options.
Referrer Policy.
Permissions Policy.
Secure cookies when using cookie based sessions.
CSRF defenses where stateful browser flows require them.
Input sanitization and validation.
Output escaping.
SQL safety via Prisma.
Auth token rotation and revocation support.
Sensitive route logging and anomaly alerts.
Data Protection
Encrypt secrets at platform level where possible.
Keep environment variables separate by environment.
Minimize personally identifiable information.
Use least privilege credentials for database and services.
Separate admin surfaces from public surfaces.
Maintain backup and restore policy for PostgreSQL.
Valid Prisma Data Model Blueprint
Below is a valid Prisma schema foundation for Via Fidei. This is intended as a production ready starting point for the real application schema and includes unique constraints for duplicate prevention, translation storage, media association, ingestion metadata, audit support, mirrored homepage editing, and favicon management.
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

enum Role {
  USER
  ADMIN
}

enum MilestoneTier {
  SACRAMENT
  SPIRITUAL
  PERSONAL
}

enum GoalStatus {
  ACTIVE
  COMPLETED
  OVERDUE
  ARCHIVED
}

enum ContentStatus {
  DRAFT
  REVIEW
  PUBLISHED
  ARCHIVED
}

enum MediaKind {
  PHOTO
  ICON
  PAINTING
  ILLUSTRATION
  STATUE
  BOOK_COVER
  FAVICON
  OTHER
}

enum ReviewStatus {
  PENDING
  AUTO_APPROVED
  HUMAN_REVIEWED
  REJECTED
}

enum TranslationStatus {
  MACHINE
  HUMAN_REVIEWED
  LOCKED
}

model User {
  id                String               @id @default(cuid())
  email             String               @unique
  passwordHash      String
  firstName         String
  lastName          String
  role              Role                 @default(USER)
  createdAt         DateTime             @default(now())
  updatedAt         DateTime             @updatedAt
  profile           Profile?
  sessions          Session[]
  journalEntries    JournalEntry[]
  savedPrayers      UserSavedPrayer[]
  savedSaints       UserSavedSaint[]
  savedApparitions  UserSavedApparition[]
  savedParishes     UserSavedParish[]
  goals             Goal[]
  milestones        Milestone[]
  auditLogs         AdminAuditLog[]      @relation("AuditActor")
}

model Session {
  id           String   @id @default(cuid())
  userId       String
  tokenHash    String   @unique
  expiresAt    DateTime
  createdAt    DateTime @default(now())
  updatedAt    DateTime @updatedAt
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId])
}

model Profile {
  id               String       @id @default(cuid())
  userId           String       @unique
  avatarMediaId    String?
  languageOverride String?
  theme            String?
  createdAt        DateTime     @default(now())
  updatedAt        DateTime     @updatedAt
  user             User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  avatarMedia      MediaAsset?  @relation(fields: [avatarMediaId], references: [id])
}

model JournalEntry {
  id          String      @id @default(cuid())
  userId      String
  title       String
  body        String
  isFavorite  Boolean     @default(false)
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt
  user        User        @relation(fields: [userId], references: [id], onDelete: Cascade)

  @@index([userId, updatedAt])
}

model Prayer {
  id            String              @id @default(cuid())
  slug          String              @unique
  defaultTitle  String
  body          String
  category      String
  status        ContentStatus       @default(DRAFT)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  translations  PrayerTranslation[]
  savedByUsers  UserSavedPrayer[]
}

model PrayerTranslation {
  id                 String            @id @default(cuid())
  prayerId           String
  locale             String
  title              String
  body               String
  translationStatus  TranslationStatus @default(MACHINE)
  translationEngine  String?
  checksum           String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  prayer             Prayer            @relation(fields: [prayerId], references: [id], onDelete: Cascade)

  @@unique([prayerId, locale])
}

model Saint {
  id                String              @id @default(cuid())
  slug              String              @unique
  canonicalName     String
  feastDay          String?
  patronages        String[]
  biography         String
  officialPrayer    String?
  externalSourceKey String?             @unique
  status            ContentStatus       @default(DRAFT)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  translations      SaintTranslation[]
  mediaLinks        EntityMediaLink[]
  savedByUsers      UserSavedSaint[]
}

model SaintTranslation {
  id                 String            @id @default(cuid())
  saintId            String
  locale             String
  name               String
  biography          String
  officialPrayer     String?
  translationStatus  TranslationStatus @default(MACHINE)
  translationEngine  String?
  checksum           String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  saint              Saint             @relation(fields: [saintId], references: [id], onDelete: Cascade)

  @@unique([saintId, locale])
}

model MarianApparition {
  id                String              @id @default(cuid())
  slug              String              @unique
  title             String
  location          String?
  country           String?
  approvedStatus    String?
  summary           String
  officialPrayer    String?
  externalSourceKey String?             @unique
  status            ContentStatus       @default(DRAFT)
  createdAt         DateTime            @default(now())
  updatedAt         DateTime            @updatedAt
  translations      MarianApparitionTranslation[]
  mediaLinks        EntityMediaLink[]
  savedByUsers      UserSavedApparition[]
}

model MarianApparitionTranslation {
  id                 String            @id @default(cuid())
  apparitionId       String
  locale             String
  title              String
  summary            String
  officialPrayer     String?
  translationStatus  TranslationStatus @default(MACHINE)
  translationEngine  String?
  checksum           String?
  createdAt          DateTime          @default(now())
  updatedAt          DateTime          @updatedAt
  apparition         MarianApparition  @relation(fields: [apparitionId], references: [id], onDelete: Cascade)

  @@unique([apparitionId, locale])
}

model Parish {
  id                String            @id @default(cuid())
  slug              String            @unique
  name              String
  address           String?
  city              String?
  region            String?
  country           String?
  phone             String?
  email             String?
  websiteUrl        String?
  diocese           String?
  ociaUrl           String?
  latitude          Float?
  longitude         Float?
  externalSourceKey String?
  sourceHost        String?
  status            ContentStatus     @default(DRAFT)
  createdAt         DateTime          @default(now())
  updatedAt         DateTime          @updatedAt
  savedByUsers      UserSavedParish[]

  @@unique([name, city, country])
}

model Goal {
  id           String       @id @default(cuid())
  userId       String
  title        String
  description  String?
  dueDate      DateTime?
  status       GoalStatus   @default(ACTIVE)
  createdAt    DateTime     @default(now())
  updatedAt    DateTime     @updatedAt
  user         User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  checklist    GoalChecklistItem[]
  milestone    Milestone?

  @@index([userId, status])
}

model GoalChecklistItem {
  id          String    @id @default(cuid())
  goalId      String
  label       String
  sortOrder   Int
  isCompleted Boolean   @default(false)
  createdAt   DateTime  @default(now())
  updatedAt   DateTime  @updatedAt
  goal        Goal      @relation(fields: [goalId], references: [id], onDelete: Cascade)

  @@unique([goalId, sortOrder])
}

model Milestone {
  id          String         @id @default(cuid())
  userId      String
  goalId      String?        @unique
  tier        MilestoneTier
  title       String
  description String?
  createdAt   DateTime       @default(now())
  updatedAt   DateTime       @updatedAt
  user        User           @relation(fields: [userId], references: [id], onDelete: Cascade)
  goal        Goal?          @relation(fields: [goalId], references: [id])

  @@index([userId, tier])
}

model UserSavedPrayer {
  userId      String
  prayerId    String
  createdAt   DateTime   @default(now())
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  prayer      Prayer     @relation(fields: [prayerId], references: [id], onDelete: Cascade)

  @@id([userId, prayerId])
}

model UserSavedSaint {
  userId      String
  saintId     String
  createdAt   DateTime   @default(now())
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  saint       Saint      @relation(fields: [saintId], references: [id], onDelete: Cascade)

  @@id([userId, saintId])
}

model UserSavedApparition {
  userId        String
  apparitionId  String
  createdAt     DateTime          @default(now())
  user          User              @relation(fields: [userId], references: [id], onDelete: Cascade)
  apparition    MarianApparition  @relation(fields: [apparitionId], references: [id], onDelete: Cascade)

  @@id([userId, apparitionId])
}

model UserSavedParish {
  userId      String
  parishId    String
  createdAt   DateTime   @default(now())
  user        User       @relation(fields: [userId], references: [id], onDelete: Cascade)
  parish      Parish     @relation(fields: [parishId], references: [id], onDelete: Cascade)

  @@id([userId, parishId])
}

model MediaAsset {
  id              String            @id @default(cuid())
  url             String
  altText         String?
  kind            MediaKind         @default(OTHER)
  sourceUrl       String?
  sourceHost      String?
  licenseInfo     String?
  attribution     String?
  checksum        String?
  reviewStatus    ReviewStatus      @default(PENDING)
  confidenceScore Float?
  createdAt       DateTime          @default(now())
  updatedAt       DateTime          @updatedAt
  entityLinks     EntityMediaLink[]
}

model EntityMediaLink {
  id           String      @id @default(cuid())
  entityType   String
  entityId     String
  mediaAssetId String
  isPrimary    Boolean     @default(false)
  sortOrder    Int         @default(0)
  createdAt    DateTime    @default(now())
  mediaAsset   MediaAsset  @relation(fields: [mediaAssetId], references: [id], onDelete: Cascade)

  @@unique([entityType, entityId, mediaAssetId])
  @@index([entityType, entityId])
}

model SiteSetting {
  id             String      @id @default(cuid())
  key            String      @unique
  valueJson      Json
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
}

model HomePage {
  id             String          @id @default(cuid())
  slug           String          @unique @default("homepage")
  title          String?
  status         ContentStatus   @default(DRAFT)
  version        Int             @default(1)
  createdAt      DateTime        @default(now())
  updatedAt      DateTime        @updatedAt
  blocks         HomePageBlock[]
}

model HomePageBlock {
  id             String      @id @default(cuid())
  pageId         String
  blockKey       String
  blockType      String
  sortOrder      Int
  configJson     Json
  createdAt      DateTime    @default(now())
  updatedAt      DateTime    @updatedAt
  page           HomePage    @relation(fields: [pageId], references: [id], onDelete: Cascade)

  @@unique([pageId, blockKey])
  @@unique([pageId, sortOrder])
}

model IngestionSource {
  id              String   @id @default(cuid())
  name            String
  host            String   @unique
  baseUrl         String
  sourceType      String
  isOfficial      Boolean  @default(false)
  rateLimitPerMin Int?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  jobs            IngestionJob[]
}

model IngestionJob {
  id                String           @id @default(cuid())
  sourceId          String
  jobName           String
  targetEntity      String
  schedule          String?
  isActive          Boolean          @default(true)
  createdAt         DateTime         @default(now())
  updatedAt         DateTime         @updatedAt
  source            IngestionSource  @relation(fields: [sourceId], references: [id], onDelete: Cascade)
  runs              IngestionJobRun[]

  @@unique([sourceId, jobName])
}

model IngestionJobRun {
  id              String        @id @default(cuid())
  jobId           String
  startedAt       DateTime
  finishedAt      DateTime?
  status          String
  recordsSeen     Int           @default(0)
  recordsCreated  Int           @default(0)
  recordsUpdated  Int           @default(0)
  recordsSkipped  Int           @default(0)
  errorMessage    String?
  createdAt       DateTime      @default(now())
  job             IngestionJob  @relation(fields: [jobId], references: [id], onDelete: Cascade)

  @@index([jobId, startedAt])
}

model AdminAuditLog {
  id             String    @id @default(cuid())
  actorUserId    String?
  action         String
  entityType     String
  entityId       String
  previousValue  Json?
  newValue       Json?
  ipAddress      String?
  userAgent      String?
  requestId      String?
  createdAt      DateTime  @default(now())
  actor          User?     @relation("AuditActor", fields: [actorUserId], references: [id], onDelete: SetNull)

  @@index([entityType, entityId, createdAt])
}
Prisma Schema Notes
Composite ids are used to prevent duplicate saves.
Composite unique constraints prevent duplicate translations and media associations.
External source keys support ingestion deduplication.
Translation tables support machine and human reviewed states.
Media tables support correct photo matching, review status, provenance, and favicon storage.
HomePage and HomePageBlock support mirrored admin editing of the public homepage.
SiteSetting can store favicon references, manifest values, and other global site level settings.
Ingestion tables track official source jobs and run history.
Audit tables preserve admin change traceability.
Search Blueprint
Unified search is a core product feature.
Search Scope
Prayers
Saints
Marian apparitions
Liturgy and history content
Spiritual life guides
Parishes
User saved content where applicable in profile context
Search Features
Global search bar
Typeahead suggestions
Grouped results by type
Filters by type
Filters by language
Highlighted terms
Ranking by relevance, language match, popularity, and editorial weight
Keyboard navigation
Search analytics for improvement
Implementation Path
Phase 1:
PostgreSQL full text search
Weighted ranking
Entity grouping
Phase 2:
External search engine such as Meilisearch or OpenSearch
Synonyms
Typo tolerance
Advanced facets
Faster multilingual relevance tuning
SEO and Discoverability Blueprint
Canonical and Metadata
Canonical domain set to https://viafidei.com
Canonical tags on all indexable pages
Open Graph and Twitter metadata
JSON LD structured data where relevant
Dynamic metadata generation from content models
Clean slugs
XML sitemaps by content type
Robots directives per environment
Favicon metadata generation across all expected icon declarations and manifest references
Structured Data Opportunities
Article
FAQPage
BreadcrumbList
WebSite
SearchAction
Organization
Place for parish data where appropriate
Accessibility Standards
The site should be elegant and fully usable.
Requirements
WCAG 2.2 AA target
Keyboard navigability
Proper focus handling
Semantic landmarks
Screen reader friendly labels
High contrast compliance
Reduced motion support
Accessible modals and dialogs
Alt text discipline for sacred art and icons
Large tap targets on mobile
Automatic language detection with graceful fallback for accessibility and user clarity
Performance Standards
Frontend
Server first rendering with Next.js
Route level code splitting
Image optimization
Lazy loading where appropriate
Streaming and suspense for large content surfaces
Optimized font loading
Avoid oversized client bundles
Real time admin preview must remain performant and not require full page reloads
Backend
Query optimization with Prisma
Redis caching for hot content
Search index caching
Queue offloading for heavy work
Pagination on large collections
Request tracing and profiling
Realtime update channels for mirrored admin homepage editing
Environment Variables
NODE_ENV=
APP_URL=
CANONICAL_URL=https://viafidei.com

DATABASE_URL=
REDIS_URL=

JWT_ACCESS_SECRET=
JWT_REFRESH_SECRET=
SESSION_SECRET=

ADMIN_USERNAME=
ADMIN_PASSWORD=

POSTMARK_SERVER_TOKEN=
EMAIL_FROM_ADDRESS=

CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=

SENTRY_DSN=
PLAUSIBLE_DOMAIN=viafidei.com

SEARCH_PROVIDER=
MEILISEARCH_HOST=
MEILISEARCH_API_KEY=

TRANSLATION_PROVIDER=
TRANSLATION_API_KEY=
TRANSLATION_DEFAULT_SOURCE_LOCALE=en
TRANSLATION_FALLBACK_LOCALE=en

CRON_SECRET=
INTERNAL_API_TOKEN=
Environment Rules
Admin credentials must come only from environment variables.
No secret may be exposed to the client.
Production values must be distinct from staging and development.
Rotation policy should exist for all major secrets.
API Blueprint
Public API Modules
auth
prayers
spiritual-life
spiritual-guidance
liturgy-history
saints
apparitions
search
localization
parishes
site-metadata
Authenticated API Modules
profile
journal
saved-prayers
saved-saints
saved-apparitions
saved-parishes
goals
milestones
settings
profile-image
Admin API Modules
admin-auth
admin-prayers
admin-saints
admin-apparitions
admin-parishes
admin-liturgy
admin-localization
admin-search
admin-ingestion
admin-audit
admin-media
admin-homepage
admin-favicon
Modular UI Component Blueprint
The frontend should be composed through a shared design system.
Core Component Groups
Header
Footer
NavBar
SearchBar
SearchResultsGroup
LanguageSelector
SectionShell
ContentCard
PrayerCard
SaintCard
ParishCard
GoalCard
MilestoneCard
JournalEditor
ConfirmationModal
AuthForm
AvatarUploader
ProfileTabs
Pagination
EmptyState
SacredIcon
BookCoverCard
AudioPlayer
FilterBar
TypeaheadList
SettingsPanel
MediaAttribution
TranslationNotice
HomePageBlockRenderer
AdminMirrorEditor
FaviconUploader
Each component must be:
Isolated
Typed
Tested
Accessible
Token driven
Reusable
Logging and Observability
Required Observability Layers
Request logs
Error monitoring
Background job logs
Admin audit trails
Search analytics
Authentication event logs
Sync job metrics
Database migration tracking
Translation pipeline metrics
Media association confidence and review metrics
Homepage save events and live preview update metrics
Favicon update and cache invalidation events
Monitoring Stack
Sentry
Structured logger such as Pino
Railway logs or external observability sink
Health checks for API, worker, Redis, and database
Testing Strategy
Required Testing Layers
Unit tests for domain logic
Integration tests for API modules
End to end tests for critical flows
Accessibility tests
Security header tests
Rate limiting tests
Localization coverage tests
Search relevance smoke tests
Admin audit tests
Ingestion deduplication tests
Media matching tests
Prisma migration validation tests
Realtime homepage editor tests
Favicon upload and propagation tests
Multi stage Docker build validation tests
Suggested Tools
Vitest
Jest if preferred by backend team
Playwright
Supertest
Testing Library
Axe
CI and CD Blueprint
Pipeline Requirements
Lint
Typecheck
Unit tests
Integration tests
Build validation
Prisma migration checks
Security checks
Multi stage Docker build validation
Deploy to staging
Smoke test translation and ingestion systems
Smoke test homepage mirror editor and favicon propagation
Manual promotion to production
Deployment Flow
Pull request validation
Merge to main
Staging deployment
Smoke tests
Production deployment
Post deploy health verification
Initial Build Phases
Phase 1
Foundation
Monorepo
Design system
Auth
Header and navigation
Home
Basic prayers
PostgreSQL
Prisma
Helmet
Rate limiting
Basic admin auth
Logging
Canonical domain setup
Device locale detection
Augustine Journal style translation layer integration
Multi stage Docker setup for all services
Phase 2
Core content and profile
Prayer library
Saints and Marian apparitions
Profile
Journal
Saved content
Goals and milestones
Localization support
Search baseline
Parish index manual version
Media asset model
Duplicate prevention constraints
Homepage block model
Favicon persistence model
Phase 3
Advanced infrastructure
Worker jobs
Scheduled ingestion
Search engine upgrade
Admin curation tools
Cloudinary media workflows
Email flows
Audit dashboards
Analytics
Official Catholic and Vatican source ingestion
Translation caching and review states
Mirrored homepage admin editor with real time preview
Favicon upload and propagation pipeline
Phase 4
Refinement
Accessibility hardening
Visual polish
Performance tuning
SEO deepening
Search ranking improvements
Broader language rollout
Media review tooling
Mobile app readiness
Admin editing ergonomics and live page management polish
Product Quality Bar
This site should feel premium and trustworthy at every layer.
Required Product Feel
Beautiful
Professional
Classy
Intuitive
Reverent
Responsive
Stable
Calm
Fast
Trustworthy
What Success Looks Like
A first time visitor should immediately feel:
This is serious and trustworthy.
This is beautiful without being distracting.
This is easy to navigate.
This is deeply Catholic and well organized.
This is technically refined and safe to use.
Summary Implementation Recommendation
Build Via Fidei as a TypeScript first, Next.js plus NestJS, Prisma plus PostgreSQL, Redis backed, queue driven, multilingual, security hardened platform with:
viafidei.com as the canonical domain
Helmet enabled from the start
Redis backed rate limiting across all critical endpoints
Strong modular architecture across web, API, admin, and worker apps
PostgreSQL persistence for all user data, admin changes, timing metadata, ingestion metadata, translation metadata, media associations, homepage block configuration, and favicon settings
Periodic approved scraping and API ingestion jobs for Vatican sites and other official Catholic sources to enrich each tab
Correct duplicate prevention across content, user saves, ingestion records, translations, media, and page blocks
A structured media association system to place the correct photos or approved sacred artwork next to saints, Our Lady entries, the Holy Family, and other sacred subjects where possible
A top centered, liturgical, modern minimalist visual identity
Beautiful, editorial quality layouts inspired by the Augustine concept but refined into a more disciplined and premium product system
Unified global search
Device language detection and automatic translation through the Augustine Journal style translation layer, with optional manual adjustment
A mirrored admin homepage editor with real time visual updates and Save Page persistence
Admin favicon upload stored through the application data model and propagated across all expected favicon usages
Full localization readiness
Strong auditability, observability, test coverage, and multi stage Docker deployment standards
A valid Prisma schema foundation that can be extended through migrations as the platform grows
