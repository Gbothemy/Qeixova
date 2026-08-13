"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import BusinessLoading from "@/components/BusinessLoading";
import BusinessSidebar from "@/components/BusinessSidebar";
import BusinessBottomNav from "@/components/BusinessBottomNav";
import { INTEREST_OPTIONS } from "@/lib/interestTaxonomy";

type MissionCategory = {
  id: string;
  name: string;
  apiCategory: string;
  missionType: "engagement" | "participation" | "premium";
  description: string;
  goals: string[];
  contentLabel: string;
  contentPlaceholder: string;
  contentTypes: string[];
  defaultActions: string[];
  defaultAudience: string[];
};

type CampaignBundle = {
  id: string;
  name: string;
  description: string;
  bestFor: string;
  platforms: string[];
  actionHint: string[];
};

type GoalInfo = {
  detail: string;
  titlePlaceholder: string;
  bundleIds: string[];
};

type PricingOption = {
  id: string;
  categoryId: string;
  bundleId: string;
  label: string;
  platform: string;
  rewardQlt: number;
  actionHint: string;
};

type ReachPackage = {
  id: string;
  name: string;
  contributors: number;
  duration: string;
};

type Business = {
  id: number;
  name: string;
  balance: number;
};

type TargetLocation = {
  id?: string;
  name?: string;
  type?: "country" | "region" | "city" | "locality" | "postal_code";
  country: string;
  countryCode?: string;
  region?: string;
  state: string;
  city: string;
  address: string;
  latitude?: number;
  longitude?: number;
  population?: number;
  contributorCount?: number;
  boundary?: {
    type: "bbox" | "polygon";
    coordinates: number[] | number[][][];
  };
  query?: string;
};

type LocationSearchResult = {
  id: string;
  name: string;
  type: "country" | "region" | "city" | "locality" | "postal_code";
  country: string;
  countryCode: string;
  region?: string;
  latitude: number;
  longitude: number;
  population?: number;
  contributorCount: number;
  boundary: {
    type: "bbox" | "polygon";
    coordinates: number[] | number[][][];
  };
};

const QLT_PER_NAIRA = 10;
const MIN_REWARD_NAIRA = 30;
const COMMISSION_RATE = 0.2;
const VERIFICATION_RATE = 0.1;
const VISIBILITY_ACTIONS = ["Keep visible for 12 hours", "Keep visible for 24 hours"] as const;
const missionCategories: MissionCategory[] = [
  {
    id: "content",
    name: "Content Distribution",
    apiCategory: "Content Distribution",
    missionType: "engagement",
    description: "Promote flyers, announcements, videos, and posts through real human distribution.",
    goals: ["Brand awareness", "Event awareness", "Product promotion", "Creator content promotion", "Local visibility"],
    contentLabel: "Content or campaign link",
    contentPlaceholder: "Paste a flyer, post, video, or landing page link",
    contentTypes: ["Flyer", "Social post", "Announcement", "Promo video", "Offer"],
    defaultActions: ["Post the campaign content", "Keep visible for 12 hours", "Submit screenshot proof"],
    defaultAudience: ["Local Promoters", "Students", "Community Influencers", "General Contributors"],
  },
  {
    id: "music",
    name: "Music Promotion",
    apiCategory: "Music Promotion",
    missionType: "engagement",
    description: "Get contributors to promote songs, cover art, artist pages, and release links across social platforms.",
    goals: ["New song awareness", "Music link promotion", "Cover art promotion", "Release promotion", "Artist visibility"],
    contentLabel: "Music, artist, or promo link",
    contentPlaceholder: "Paste the song, artist page, promo post, TikTok, YouTube, Audiomack, or other campaign link",
    contentTypes: ["Song link", "Cover art"],
    defaultActions: ["Open the music campaign link", "Share or post the selected music asset on the required platform", "Submit screenshot proof of the promotion"],
    defaultAudience: ["Music Supporters", "Creators", "Students", "Verified Contributors"],
  },
  {
    id: "community",
    name: "Community Growth",
    apiCategory: "Community Growth",
    missionType: "participation",
    description: "Grow Telegram, WhatsApp, Discord, and online communities with structured participation.",
    goals: ["New community launch", "Increase members"],
    contentLabel: "Community invite link",
    contentPlaceholder: "Paste WhatsApp, Telegram, Discord, or Facebook Group link",
    contentTypes: ["WhatsApp community", "Telegram group", "Discord server", "Facebook group"],
    defaultActions: ["Join the community", "Read the community rules", "Submit join proof"],
    defaultAudience: ["Community Builders", "Verified Contributors", "Local Promoters", "Students"],
  },
  {
    id: "apps",
    name: "App Testing & Reviews",
    apiCategory: "App Testing",
    missionType: "participation",
    description: "Run app installs, onboarding tests, bug reports, feature checks, and structured app review missions.",
    goals: ["Install and open test", "Signup/onboarding test", "Bug discovery", "Feature testing", "App review"],
    contentLabel: "App or test link",
    contentPlaceholder: "Paste Play Store, App Store, web app, APK, TestFlight, or test instruction link",
    contentTypes: ["Android app", "iOS app", "Web app", "APK test", "Onboarding flow", "Feature prototype"],
    defaultActions: ["Open or install the app", "Complete the assigned test steps", "Submit screenshot proof and useful feedback"],
    defaultAudience: ["Tech Testers", "Verified Contributors", "Beta Test Participants", "Premium Contributors"],
  },
  {
    id: "feedback",
    name: "Surveys & Feedback",
    apiCategory: "Feedback Campaign",
    missionType: "participation",
    description: "Collect product feedback, survey responses, content opinions, market research, and validation insights.",
    goals: ["Product feedback", "Content feedback", "Survey and opinions", "Feature validation", "Market research"],
    contentLabel: "Product, content, survey, or context link",
    contentPlaceholder: "Paste the form, product page, website, video, document, or research brief link",
    contentTypes: ["Short survey", "Product feedback", "Content feedback", "Feature validation", "Market research", "Detailed review"],
    defaultActions: ["Review the campaign context carefully", "Answer the feedback questions honestly", "Submit a clear written response"],
    defaultAudience: ["Verified Contributors", "Experienced Reviewers", "Students", "General Contributors"],
  },
];

const interestOptions = [...INTEREST_OPTIONS];

const categoryInterestDefaults: Record<string, string[]> = {
  content: ["Business & Entrepreneurship", "Events & Social Activities", "Campus & Student Life"],
  music: ["Music & Entertainment", "Events & Social Activities", "Campus & Student Life"],
  community: ["Faith & Inspiration", "Public Awareness & Social Impact", "Campus & Student Life"],
  apps: ["Tech & Apps", "Gaming & Esports", "Business & Entrepreneurship"],
  feedback: ["Business & Entrepreneurship", "Education & Learning", "Public Awareness & Social Impact"],
};

const visibleMissionCategories = missionCategories.filter((category) => !["apps", "feedback"].includes(category.id));

const bundles: CampaignBundle[] = [
  {
    id: "story-status",
    name: "Story & Status Awareness",
    description: "WhatsApp, Instagram, Facebook, Telegram, TikTok, and Snapchat status visibility.",
    bestFor: "flyers, event visibility, local awareness, creator awareness",
    platforms: ["WhatsApp", "Instagram", "Facebook", "Telegram", "TikTok", "Snapchat"],
    actionHint: ["Keep visible for 12 hours", "Submit screenshot proof"],
  },
  {
    id: "short-video",
    name: "Short-Form Video Boost",
    description: "TikTok, Instagram Reels, and Facebook Reels participation.",
    bestFor: "viral momentum, music campaigns, creator growth, promo videos",
    platforms: ["TikTok", "Instagram Reels", "Facebook Reels"],
    actionHint: ["Watch or repost video", "Use required caption or campaign instruction", "Submit link or screenshot proof"],
  },
  {
    id: "community-distribution",
    name: "Community Distribution",
    description: "WhatsApp Groups, Telegram Communities, and Facebook Groups.",
    bestFor: "local visibility, event promotion, community awareness",
    platforms: ["WhatsApp Groups", "Telegram Communities", "Facebook Groups"],
    actionHint: ["Share to relevant community", "Respect group rules", "Submit screenshot proof"],
  },
  {
    id: "streaming-awareness",
    name: "Music Link Promotion",
    description: "Promote song links, artist pages, release pages, and music campaign URLs.",
    bestFor: "song promotion, release awareness, artist visibility",
    platforms: ["Music Link", "Artist Page", "Release Page", "Promo Link"],
    actionHint: ["Open the campaign link", "Share or promote the music link as instructed", "Submit screenshot proof of the promotion"],
  },
  {
    id: "user-feedback",
    name: "Survey & Feedback Response",
    description: "Structured surveys, written opinions, product reviews, and validation responses.",
    bestFor: "customer feedback, audience insights, product validation, research",
    platforms: ["Survey Form", "Product Page", "Website", "Content Link", "Research Brief"],
    actionHint: ["Open the feedback context", "Answer every required question", "Submit a clear written response"],
  },
  {
    id: "app-growth",
    name: "App Testing Mission",
    description: "App installs, onboarding checks, feature tests, bug discovery, and app review tasks.",
    bestFor: "app installs, QA testing, onboarding checks, startup growth",
    platforms: ["Android", "iOS", "Web App", "APK", "TestFlight", "Feature Prototype"],
    actionHint: ["Install or open the app", "Complete the assigned test path", "Submit screenshots and feedback"],
  },
  {
    id: "community-expansion",
    name: "Community Expansion",
    description: "Grow online communities with join proof and retention rules.",
    bestFor: "Telegram growth, WhatsApp communities, audience expansion",
    platforms: ["Telegram", "WhatsApp", "Discord"],
    actionHint: ["Join the community", "Stay for required duration", "Submit join/final proof"],
  },
];

const reachPackages: ReachPackage[] = [
  { id: "starter", name: "Starter", contributors: 50, duration: "3 days" },
  { id: "growth", name: "Growth", contributors: 100, duration: "5 days" },
  { id: "momentum", name: "Momentum", contributors: 250, duration: "7 days" },
];

const steps = ["Category", "Goal", "Content", "Bundle & Platform", "Actions & Reach", "Location", "Preview"];
const stepHeroCopy = [
  {
    eyebrow: "Step 1 / Mission category",
    title: "Select the campaign mission category",
    description: "Choose the type of growth participation this campaign needs before setting goals, content, platforms, reach, and location.",
  },
  {
    eyebrow: "Step 2 / Campaign goal",
    title: "Choose the campaign goal",
    description: "Pick the goal that should guide reward recommendations, contributor actions, proof style, and the best campaign path.",
  },
  {
    eyebrow: "Step 3 / Campaign content",
    title: "Attach the content contributors will use",
    description: "Upload or link the exact flyer, post, video, app, community, survey, or asset contributors need to complete the mission.",
  },
  {
    eyebrow: "Step 4 / Bundle and platform",
    title: "Select the bundle and platform",
    description: "Choose where contributors should participate, then select the exact platform actions that match your campaign content.",
  },
  {
    eyebrow: "Step 5 / Actions and reach",
    title: "Confirm contributor actions and reach",
    description: "Set what contributors must do, how many people should complete the campaign, and the reward budget for each approval.",
  },
  {
    eyebrow: "Step 6 / Audience and location",
    title: "Target the right contributors",
    description: "Choose matching interests and decide whether the campaign should reach contributors nationwide or in specific locations.",
  },
  {
    eyebrow: "Step 7 / Campaign preview",
    title: "Review the campaign before payment",
    description: "Check the contributor experience, content, platforms, reward, reach, location, and total campaign cost before submitting.",
  },
];
const MAX_STORED_ASSET_BYTES = 2.5 * 1024 * 1024;
const DRAFT_VERSION = 1;
const DRAFT_SAVE_DELAY_MS = 550;

type CampaignBuilderDraft = {
  version: number;
  savedAt: string;
  stepIndex: number;
  categoryId: string;
  goal: string;
  title: string;
  objective: string;
  contentType: string;
  contentCaption: string;
  contentLink: string;
  assetName: string;
  assetDataUrl: string;
  assetMimeType: string;
  bundleId: string;
  selectedPricingIds: string[];
  actions: string[];
  appContributorInstructions: string;
  audience: string[];
  selectedInterests: string[];
  reachId: string;
  customContributors: string;
  locationMode: "nationwide" | "exact";
  targetLocations: TargetLocation[];
  locationSearchDraft: TargetLocation;
};

const goalInfo: Record<string, GoalInfo> = {
  "Brand awareness": {
    detail: "Put your brand in front of real people through simple social visibility actions.",
    titlePlaceholder: "Build awareness for my fashion brand",
    bundleIds: ["story-status", "short-video", "community-distribution"],
  },
  "Event awareness": {
    detail: "Spread event flyers, reminders, and announcements before the event date.",
    titlePlaceholder: "Promote my Lagos pop-up event",
    bundleIds: ["story-status", "community-distribution", "short-video"],
  },
  "Product promotion": {
    detail: "Get contributors to share product offers, launches, and sales content.",
    titlePlaceholder: "Promote my skincare product launch",
    bundleIds: ["story-status", "short-video", "community-distribution"],
  },
  "Creator content promotion": {
    detail: "Push creator posts, videos, and announcements across audience-friendly channels.",
    titlePlaceholder: "Boost my new creator content drop",
    bundleIds: ["short-video", "story-status", "community-distribution"],
  },
  "Local visibility": {
    detail: "Reach nearby audiences through local groups, statuses, and community shares.",
    titlePlaceholder: "Increase visibility for my local business",
    bundleIds: ["community-distribution", "story-status"],
  },
  "New song awareness": {
    detail: "Get contributors to promote a new song or artist through status posts, stories, and social sharing.",
    titlePlaceholder: "Promote my new single",
    bundleIds: ["story-status", "streaming-awareness", "short-video"],
  },
  "Music link promotion": {
    detail: "Get contributors to share, post, or promote your music link to real audiences.",
    titlePlaceholder: "Promote my new song link",
    bundleIds: ["streaming-awareness"],
  },
  "Cover art promotion": {
    detail: "Get contributors to post your cover art with your music link or release message.",
    titlePlaceholder: "Promote my song cover art",
    bundleIds: ["story-status", "short-video"],
  },
  "Release promotion": {
    detail: "Push a song, EP, album, or artist release through status, story, link, and social promo actions.",
    titlePlaceholder: "Promote my new music release",
    bundleIds: ["short-video", "story-status"],
  },
  "Artist visibility": {
    detail: "Grow recognition for an artist through contributor shares, status posts, and social promotion.",
    titlePlaceholder: "Increase visibility for my artist profile",
    bundleIds: ["story-status", "streaming-awareness", "short-video"],
  },
  "New community launch": {
    detail: "Bring initial members into a new group or community with join proof.",
    titlePlaceholder: "Launch my Telegram community",
    bundleIds: ["community-expansion"],
  },
  "Increase members": {
    detail: "Grow membership count while requiring contributors to stay for a set period.",
    titlePlaceholder: "Grow my WhatsApp community",
    bundleIds: ["community-expansion"],
  },
  "Install and open test": {
    detail: "Ask contributors to install or open your app, confirm it loads, and share first-use feedback.",
    titlePlaceholder: "Test installs for my app",
    bundleIds: ["app-growth"],
  },
  "Signup/onboarding test": {
    detail: "Test account creation, onboarding screens, permissions, and where users get stuck.",
    titlePlaceholder: "Test signup flow for my fintech app",
    bundleIds: ["app-growth"],
  },
  "Bug discovery": {
    detail: "Send testers through specific app paths to find bugs, crashes, broken screens, and friction.",
    titlePlaceholder: "Find bugs in my marketplace app",
    bundleIds: ["app-growth"],
  },
  "Feature testing": {
    detail: "Validate a new app feature with screenshots, task completion proof, and tester notes.",
    titlePlaceholder: "Test the new wallet feature",
    bundleIds: ["app-growth"],
  },
  "App review": {
    detail: "Collect structured impressions, usability notes, and screenshots after contributors use your app.",
    titlePlaceholder: "Collect app review feedback",
    bundleIds: ["app-growth"],
  },
  "Product feedback": {
    detail: "Collect opinions about a product, landing page, offer, service, or prototype.",
    titlePlaceholder: "Get feedback on my product page",
    bundleIds: ["user-feedback"],
  },
  "Content feedback": {
    detail: "Ask contributors to review copy, design, video, article, flyer, or creative content.",
    titlePlaceholder: "Review my Instagram campaign content",
    bundleIds: ["user-feedback"],
  },
  "Survey and opinions": {
    detail: "Run a quick survey, poll, or opinion task for lightweight audience insight.",
    titlePlaceholder: "Run a quick customer opinion survey",
    bundleIds: ["user-feedback"],
  },
  "Feature validation": {
    detail: "Validate whether a proposed product or app feature is clear, useful, and worth building.",
    titlePlaceholder: "Validate my new booking feature idea",
    bundleIds: ["user-feedback"],
  },
  "Market research": {
    detail: "Gather early signals about demand, pricing, audience preferences, and positioning.",
    titlePlaceholder: "Research demand for my new service",
    bundleIds: ["user-feedback"],
  },
};

const pricingOptions: PricingOption[] = [
  { id: "content-whatsapp-status", categoryId: "content", bundleId: "story-status", label: "WhatsApp status post", platform: "WhatsApp", rewardQlt: 1200, actionHint: "Post to WhatsApp status and submit screenshot proof" },
  { id: "content-instagram-status", categoryId: "content", bundleId: "story-status", label: "Instagram status post", platform: "Instagram", rewardQlt: 700, actionHint: "Post to Instagram status and submit screenshot proof" },
  { id: "content-facebook-status", categoryId: "content", bundleId: "story-status", label: "Facebook status post", platform: "Facebook", rewardQlt: 750, actionHint: "Post to Facebook status and submit screenshot proof" },
  { id: "content-telegram-status", categoryId: "content", bundleId: "story-status", label: "Telegram status post", platform: "Telegram", rewardQlt: 500, actionHint: "Post to Telegram status and submit screenshot proof" },
  { id: "content-tiktok-status", categoryId: "content", bundleId: "story-status", label: "TikTok status post", platform: "TikTok", rewardQlt: 800, actionHint: "Post to TikTok status and submit screenshot proof" },
  { id: "content-snapchat-status", categoryId: "content", bundleId: "story-status", label: "Snapchat status post", platform: "Snapchat", rewardQlt: 600, actionHint: "Post to Snapchat status/story and submit screenshot proof" },
  { id: "content-whatsapp-group", categoryId: "content", bundleId: "community-distribution", label: "WhatsApp group share", platform: "WhatsApp Groups", rewardQlt: 1500, actionHint: "Share to a WhatsApp group/community and submit proof" },
  { id: "content-facebook-group", categoryId: "content", bundleId: "community-distribution", label: "Facebook group share", platform: "Facebook Groups", rewardQlt: 1800, actionHint: "Share to a Facebook group and submit proof" },
  { id: "content-telegram-community", categoryId: "content", bundleId: "community-distribution", label: "Telegram community share", platform: "Telegram Communities", rewardQlt: 1600, actionHint: "Share to a Telegram community and submit proof" },
  { id: "video-tiktok-share", categoryId: "content", bundleId: "short-video", label: "TikTok Share", platform: "TikTok", rewardQlt: 3000, actionHint: "Share the short video on TikTok and submit proof" },
  { id: "video-instagram-reel", categoryId: "content", bundleId: "short-video", label: "Instagram Reel Share", platform: "Instagram Reels", rewardQlt: 4000, actionHint: "Share the reel on Instagram and submit proof" },
  { id: "video-facebook-reel", categoryId: "content", bundleId: "short-video", label: "Facebook Reel Share", platform: "Facebook Reels", rewardQlt: 4000, actionHint: "Share the reel on Facebook and submit proof" },
  { id: "video-youtube-shorts", categoryId: "content", bundleId: "short-video", label: "YouTube Shorts Share", platform: "YouTube Shorts", rewardQlt: 3000, actionHint: "Share as a YouTube Short and submit proof" },
  { id: "video-whatsapp-status", categoryId: "content", bundleId: "short-video", label: "WhatsApp Status Video Share", platform: "WhatsApp Status", rewardQlt: 4500, actionHint: "Share the video on WhatsApp Status and submit proof" },
  { id: "video-x-twitter", categoryId: "content", bundleId: "short-video", label: "X (Twitter) Share", platform: "X (Twitter)", rewardQlt: 4000, actionHint: "Share the short video on X and submit proof" },
  { id: "music-whatsapp-status", categoryId: "music", bundleId: "story-status", label: "WhatsApp music status promo", platform: "WhatsApp", rewardQlt: 1200, actionHint: "Post the approved song link, cover art, or music promo to WhatsApp status and submit screenshot proof" },
  { id: "music-instagram-story", categoryId: "music", bundleId: "story-status", label: "Instagram music story promo", platform: "Instagram", rewardQlt: 700, actionHint: "Post the approved music promo to Instagram story and submit screenshot proof" },
  { id: "music-facebook-story", categoryId: "music", bundleId: "story-status", label: "Facebook music story promo", platform: "Facebook", rewardQlt: 750, actionHint: "Post the approved music promo to Facebook story and submit screenshot proof" },
  { id: "music-telegram-status", categoryId: "music", bundleId: "story-status", label: "Telegram music status promo", platform: "Telegram", rewardQlt: 500, actionHint: "Post the approved music promo to Telegram status/story and submit screenshot proof" },
  { id: "music-tiktok-story", categoryId: "music", bundleId: "story-status", label: "TikTok music story promo", platform: "TikTok", rewardQlt: 800, actionHint: "Post the approved music promo to TikTok story and submit screenshot proof" },
  { id: "music-snapchat-status", categoryId: "music", bundleId: "story-status", label: "Snapchat music status promo", platform: "Snapchat", rewardQlt: 600, actionHint: "Post the approved music promo to Snapchat status/story and submit screenshot proof" },
  { id: "music-audiomack-link", categoryId: "music", bundleId: "streaming-awareness", label: "Audiomack link promotion", platform: "Audiomack", rewardQlt: 1000, actionHint: "Share or post the Audiomack music link as instructed and submit screenshot proof" },
  { id: "music-spotify-link", categoryId: "music", bundleId: "streaming-awareness", label: "Spotify link promotion", platform: "Spotify", rewardQlt: 1100, actionHint: "Share or post the Spotify music link as instructed and submit screenshot proof" },
  { id: "music-boomplay-link", categoryId: "music", bundleId: "streaming-awareness", label: "Boomplay link promotion", platform: "Boomplay", rewardQlt: 1000, actionHint: "Share or post the Boomplay music link as instructed and submit screenshot proof" },
  { id: "music-apple-link", categoryId: "music", bundleId: "streaming-awareness", label: "Apple Music link promotion", platform: "Apple Music", rewardQlt: 1100, actionHint: "Share or post the Apple Music link as instructed and submit screenshot proof" },
  { id: "music-youtube-link", categoryId: "music", bundleId: "streaming-awareness", label: "YouTube music link promotion", platform: "YouTube", rewardQlt: 1200, actionHint: "Share or post the YouTube music link as instructed and submit screenshot proof" },
  { id: "music-tiktok-link", categoryId: "music", bundleId: "streaming-awareness", label: "TikTok music link promotion", platform: "TikTok", rewardQlt: 1200, actionHint: "Share or post the TikTok music link as instructed and submit screenshot proof" },
  { id: "music-artist-page", categoryId: "music", bundleId: "streaming-awareness", label: "Artist page promotion", platform: "Artist Page", rewardQlt: 1200, actionHint: "Share or post the artist page as instructed and submit screenshot proof" },
  { id: "music-promo-url", categoryId: "music", bundleId: "streaming-awareness", label: "Promo URL promotion", platform: "Promo URL", rewardQlt: 1000, actionHint: "Share or post the music promo URL as instructed and submit screenshot proof" },
  { id: "music-whatsapp-video", categoryId: "music", bundleId: "short-video", label: "WhatsApp Status Video music promo", platform: "WhatsApp Status Video", rewardQlt: 1400, actionHint: "Post the approved music video promo to WhatsApp Status and submit screenshot proof" },
  { id: "music-instagram-reel", categoryId: "music", bundleId: "short-video", label: "Instagram Reel music promo", platform: "Instagram Reel", rewardQlt: 2000, actionHint: "Create or repost an Instagram Reel using the approved music promo asset or link and submit proof" },
  { id: "music-facebook-reel", categoryId: "music", bundleId: "short-video", label: "Facebook Reel music promo", platform: "Facebook Reel", rewardQlt: 1800, actionHint: "Create or repost a Facebook Reel using the approved music promo asset or link and submit proof" },
  { id: "music-tiktok-video", categoryId: "music", bundleId: "short-video", label: "TikTok Video music promo", platform: "TikTok Video", rewardQlt: 2000, actionHint: "Create or repost a TikTok video using the approved music promo asset or link and submit proof" },
  { id: "music-youtube-shorts", categoryId: "music", bundleId: "short-video", label: "YouTube Shorts music promo", platform: "YouTube Shorts", rewardQlt: 1900, actionHint: "Create or repost a YouTube Short using the approved music promo asset or link and submit proof" },
  { id: "music-snapchat-spotlight", categoryId: "music", bundleId: "short-video", label: "Snapchat Spotlight music promo", platform: "Snapchat Spotlight", rewardQlt: 1500, actionHint: "Create or repost a Snapchat Spotlight using the approved music promo asset or link and submit proof" },
  { id: "community-24h", categoryId: "community", bundleId: "community-expansion", label: "Join community + 24-hour retention", platform: "Community", rewardQlt: 800, actionHint: "Join the community, stay for 24 hours, and submit proof" },
  { id: "community-3day-intro", categoryId: "community", bundleId: "community-expansion", label: "Join + intro + 3-day retention", platform: "Community", rewardQlt: 1200, actionHint: "Join, introduce yourself, stay for 3 days, and submit proof" },
  { id: "community-7day-participation", categoryId: "community", bundleId: "community-expansion", label: "Join + meaningful participation + 7-day retention", platform: "Community", rewardQlt: 2000, actionHint: "Join, participate meaningfully, stay for 7 days, and submit proof" },
  { id: "app-android-install", categoryId: "apps", bundleId: "app-growth", label: "Android install + open test", platform: "Android", rewardQlt: 3000, actionHint: "Install/open the Android app, complete the assigned checks, and submit screenshot proof with feedback" },
  { id: "app-ios-install", categoryId: "apps", bundleId: "app-growth", label: "iOS install + open test", platform: "iOS", rewardQlt: 3500, actionHint: "Install/open the iOS app, complete the assigned checks, and submit screenshot proof with feedback" },
  { id: "app-web-test", categoryId: "apps", bundleId: "app-growth", label: "Web app test", platform: "Web App", rewardQlt: 2500, actionHint: "Open the web app, test the assigned flow, and submit screenshot proof with feedback" },
  { id: "app-apk-test", categoryId: "apps", bundleId: "app-growth", label: "APK test", platform: "APK", rewardQlt: 4000, actionHint: "Install the APK, complete the assigned checks, and submit screenshot proof with feedback" },
  { id: "app-onboarding-test", categoryId: "apps", bundleId: "app-growth", label: "Signup/onboarding test", platform: "Onboarding", rewardQlt: 5000, actionHint: "Complete signup or onboarding, note any confusion, and submit screenshot proof with feedback" },
  { id: "app-bug-discovery", categoryId: "apps", bundleId: "app-growth", label: "Bug discovery report", platform: "Bug Report", rewardQlt: 8000, actionHint: "Test the assigned feature path, document bugs or friction, and submit screenshots with clear notes" },
  { id: "app-feature-test", categoryId: "apps", bundleId: "app-growth", label: "Feature testing report", platform: "Feature Test", rewardQlt: 7000, actionHint: "Test the selected feature, confirm what worked or failed, and submit screenshots with feedback" },
  { id: "app-review", categoryId: "apps", bundleId: "app-growth", label: "Structured app review", platform: "App Review", rewardQlt: 4500, actionHint: "Use the app, review the experience, and submit screenshots with a structured response" },
  { id: "feedback-short-survey", categoryId: "feedback", bundleId: "user-feedback", label: "Short survey/opinion", platform: "Survey Form", rewardQlt: 1500, actionHint: "Complete every required survey question with honest answers" },
  { id: "feedback-product", categoryId: "feedback", bundleId: "user-feedback", label: "Product feedback", platform: "Product Page", rewardQlt: 3000, actionHint: "Review the product or service context and submit useful feedback" },
  { id: "feedback-content", categoryId: "feedback", bundleId: "user-feedback", label: "Content feedback", platform: "Content Link", rewardQlt: 2500, actionHint: "Review the content and submit clear feedback on message, design, or clarity" },
  { id: "feedback-feature-validation", categoryId: "feedback", bundleId: "user-feedback", label: "Feature validation", platform: "Feature Brief", rewardQlt: 3500, actionHint: "Review the feature idea or prototype and explain whether it is useful, clear, and worth building" },
  { id: "feedback-market-research", categoryId: "feedback", bundleId: "user-feedback", label: "Market research response", platform: "Research Brief", rewardQlt: 4000, actionHint: "Review the research brief and answer the audience, demand, pricing, or positioning questions" },
  { id: "feedback-detailed-review", categoryId: "feedback", bundleId: "user-feedback", label: "Detailed review", platform: "Review Form", rewardQlt: 5000, actionHint: "Submit a detailed review with useful observations and clear reasoning" },
];

function toQlt(naira: number) {
  return Math.round(naira * QLT_PER_NAIRA);
}

function qltToNaira(qlt: number) {
  return qlt / QLT_PER_NAIRA;
}

function isPricingOptionForGoal(option: PricingOption, goal: string) {
  const normalizedGoal = goal.toLowerCase();

  if (option.categoryId === "apps") {
    if (normalizedGoal.includes("install")) return ["app-android-install", "app-ios-install", "app-web-test", "app-apk-test"].includes(option.id);
    if (normalizedGoal.includes("signup") || normalizedGoal.includes("onboarding")) return option.id === "app-onboarding-test";
    if (normalizedGoal.includes("bug")) return option.id === "app-bug-discovery";
    if (normalizedGoal.includes("feature")) return option.id === "app-feature-test";
    if (normalizedGoal.includes("review")) return option.id === "app-review";
  }

  if (option.categoryId === "feedback") {
    if (normalizedGoal.includes("product")) return option.id === "feedback-product";
    if (normalizedGoal.includes("content")) return option.id === "feedback-content";
    if (normalizedGoal.includes("survey") || normalizedGoal.includes("opinion")) return option.id === "feedback-short-survey";
    if (normalizedGoal.includes("feature")) return option.id === "feedback-feature-validation";
    if (normalizedGoal.includes("market")) return option.id === "feedback-market-research";
  }

  return true;
}

function getPricingOptions(categoryId: string, bundleId: string, goal = "") {
  return pricingOptions.filter((option) => (
    option.categoryId === categoryId
    && option.bundleId === bundleId
    && isPricingOptionForGoal(option, goal)
  ));
}

function getGoalInfo(goal: string) {
  return goalInfo[goal] ?? {
    detail: "Use this goal to guide the recommended actions, proof style, and platforms.",
    titlePlaceholder: "Promote my campaign",
    bundleIds: bundles.map((bundle) => bundle.id),
  };
}

function getRecommendedBundles(categoryId: string, goal: string) {
  const info = getGoalInfo(goal);
  return bundles.filter((bundle) => {
    const hasPricing = pricingOptions.some((option) => option.categoryId === categoryId && option.bundleId === bundle.id);
    return hasPricing && info.bundleIds.includes(bundle.id);
  });
}

function summarizePricingOptions(options: PricingOption[]) {
  if (options.length === 0) return "";
  if (options.length === 1) return options[0].label;
  return options.map((option) => option.label).join(" + ");
}

function summarizeTargetLocation(location: TargetLocation) {
  if (location.name) {
    const placeParts = location.type === "region"
      ? [location.name, location.country]
      : [location.name, location.region, location.country];

    return placeParts
      .map((item) => item?.trim())
      .filter(Boolean)
      .join(", ");
  }

  return [location.address, location.city, location.state, location.country]
    .map((item) => item.trim())
    .filter(Boolean)
    .join(", ");
}

function normalizeTargetState(value: string) {
  const normalized = value
    .trim()
    .replace(/\s+State$/i, "")
    .replace(/^Federal Capital Territory$/i, "FCT - Abuja");

  if (/^(fct|abuja|fct - abuja)$/i.test(normalized)) return "FCT - Abuja";
  return normalized;
}

function getStateTarget(location: TargetLocation) {
  if (location.type === "country") return "";
  const candidate = location.state.trim() || location.region?.trim() || location.name?.trim() || "";
  return normalizeTargetState(candidate);
}

function isTargetLocationFilled(location: TargetLocation) {
  return Boolean(location.id) || location.state.trim().length > 1 || location.city.trim().length > 1 || location.address.trim().length > 2;
}

function createEmptyTargetLocation(): TargetLocation {
  return { country: "Nigeria", state: "", city: "", address: "", query: "" };
}

function buildActionsForPricing(baseActions: string[], options: PricingOption[]) {
  if (options.length === 0) return baseActions;

  const platformActions = options.map((option) => option.actionHint);
  const supportingActions = baseActions.filter((action) => (
    !/^post (?:the )?campaign content$/i.test(action)
    && !/keep .*visible/i.test(action)
    && !/^submit\b/i.test(action)
  ));
  const visibilityAction = baseActions.find((action) => /keep .*visible/i.test(action))
    ?? (options.some((option) => option.bundleId === "story-status") ? "Keep visible for 12 hours" : undefined);
  const proofAction = baseActions.find((action) => /^submit\b/i.test(action));

  return [...new Set([
    ...supportingActions,
    ...platformActions,
    visibilityAction,
    proofAction,
  ].filter((action): action is string => Boolean(action)))];
}

function normalizeCampaignActions(actions: string[]) {
  return [...new Set(actions
    .filter((action) => !/^post to story\/status$/i.test(action.trim()))
    .map((action) => /keep (?:it )?visible for the required duration/i.test(action)
      ? "Keep visible for 12 hours"
      : action))];
}

function getActionChoices(actions: string[]) {
  if (!actions.some((action) => /keep .*visible/i.test(action))) return actions;

  const choices: string[] = [];
  for (const action of actions) {
    if (/keep .*visible/i.test(action)) {
      if (!choices.some((choice) => /keep .*visible/i.test(choice))) choices.push(...VISIBILITY_ACTIONS);
      continue;
    }
    choices.push(action);
  }
  return choices;
}

function cleanActionForContributor(action: string) {
  return action
    .replace(/\s+and submit (?:a )?(?:clear )?(?:link or screenshot|screenshot|screenshots|join\/final)?\s*proof(?: with feedback| of the promotion)?\.?$/i, "")
    .replace(/\s+and submit proof\.?$/i, "")
    .replace(/\s+and submit screenshot proof\.?$/i, "")
    .trim();
}

function buildContributorSteps(input: {
  hasUploadedAsset: boolean;
  hasContentLink: boolean;
  categoryId: string;
  actions: string[];
  selectedPricingOptions: PricingOption[];
  appGuidedSteps: string[];
}) {
  const assetStep = input.hasUploadedAsset && !input.hasContentLink
    ? "Download the uploaded campaign content first, then upload or share it manually on the required platform if the platform cannot preview it."
    : "";
  const selectedPlatformSteps = input.selectedPricingOptions
    .map((option) => cleanActionForContributor(option.actionHint))
    .filter(Boolean);
  const fallbackSteps = input.actions
    .map(cleanActionForContributor)
    .filter((step) => step && !/^submit\b/i.test(step));
  const keepVisibleStep = input.actions.find((step) => /keep .*visible/i.test(step));
  const proofStep = input.categoryId === "feedback"
    ? "Submit a clear written response"
    : input.categoryId === "apps"
      ? "Submit screenshots and useful feedback"
      : "Submit screenshot proof";

  const actionSteps = input.categoryId === "apps"
    ? input.appGuidedSteps.map(cleanActionForContributor).filter(Boolean)
    : (selectedPlatformSteps.length > 0 ? selectedPlatformSteps : fallbackSteps);

  return [...new Set([
    assetStep,
    ...actionSteps,
    keepVisibleStep,
    proofStep,
  ].filter(Boolean))];
}

function getBundleDisplay(bundle: CampaignBundle, categoryId: string) {
  if (categoryId === "apps" && bundle.id === "app-growth") {
    return {
      ...bundle,
      name: "App Testing & Review Flow",
      description: "Choose the app platform or testing path contributors must complete before submitting proof and feedback.",
      platforms: ["Android", "iOS", "Web App", "APK", "Onboarding", "Bug Report", "Feature Test", "App Review"],
      actionHint: ["Open or install the app", "Complete the assigned test flow", "Submit screenshots and useful feedback"],
    };
  }

  if (categoryId === "feedback" && bundle.id === "user-feedback") {
    return {
      ...bundle,
      name: "Survey & Feedback Flow",
      description: "Choose the feedback format contributors must complete with a clear written response.",
      platforms: ["Survey Form", "Product Page", "Content Link", "Feature Brief", "Research Brief", "Review Form"],
      actionHint: ["Open the feedback context", "Answer every required question", "Submit a clear written response"],
    };
  }

  if (categoryId !== "music") return bundle;

  if (bundle.id === "story-status") {
    return {
      ...bundle,
      name: "Music Status Promotion",
      description: "Contributors post your song link, cover art, or release promo on WhatsApp, Instagram, Facebook, Telegram, TikTok, and Snapchat.",
      platforms: ["WhatsApp", "Instagram", "Facebook", "Telegram", "TikTok", "Snapchat"],
      actionHint: ["Post the approved music promo asset", "Keep visible for 12 hours", "Submit screenshot proof of the promotion"],
    };
  }

  if (bundle.id === "short-video") {
    return {
      ...bundle,
      name: "Short Video Music Promotion",
      description: "Contributors promote your music through short-form video platforms using your approved promo asset or link.",
      platforms: ["WhatsApp Status Video", "Instagram Reel", "Facebook Reel", "TikTok Video", "YouTube Shorts", "Snapchat Spotlight"],
      actionHint: ["Create or repost the approved music promo", "Use the provided caption or campaign instruction", "Submit link or screenshot proof"],
    };
  }

  if (bundle.id === "streaming-awareness") {
    return {
      ...bundle,
      name: "Music Link Promotion",
      description: "Contributors share your song link, artist page, release page, or promo URL to help push the music campaign.",
      platforms: ["Audiomack", "Spotify", "Boomplay", "Apple Music", "YouTube", "TikTok", "Artist Page", "Promo URL"],
      actionHint: ["Open the campaign link", "Share or post the music link as instructed", "Submit screenshot proof of the promotion"],
    };
  }

  return bundle;
}

function getRewardRecommendation(categoryId: string, goal: string, bundleId: string, contentType: string) {
  const combined = `${categoryId} ${goal} ${bundleId} ${contentType}`.toLowerCase();

  if (categoryId === "apps") {
    if (combined.includes("bug") || combined.includes("feature")) return { label: "High-effort mission", naira: 300, min: 150, max: 500 };
    if (combined.includes("signup") || combined.includes("onboarding")) return { label: "High-effort mission", naira: 250, min: 150, max: 400 };
    return { label: "High-effort mission", naira: 150, min: 150, max: 400 };
  }
  if (categoryId === "feedback") {
    if (combined.includes("detailed") || combined.includes("review")) return { label: "Verified engagement mission", naira: 200, min: 80, max: 200 };
    if (combined.includes("product") || combined.includes("content") || combined.includes("feature")) return { label: "Verified engagement mission", naira: 120, min: 80, max: 150 };
    return { label: "Verified engagement mission", naira: 80, min: 80, max: 150 };
  }
  if (categoryId === "community") {
    if (combined.includes("retention")) return { label: "Verified engagement mission", naira: 120, min: 80, max: 200 };
    return { label: "Verified engagement mission", naira: 80, min: 80, max: 150 };
  }
  if (categoryId === "music") {
    if (combined.includes("video") || combined.includes("reels") || combined.includes("tiktok")) return { label: "High-effort mission", naira: 250, min: 150, max: 400 };
    if (combined.includes("music link") || combined.includes("release") || combined.includes("artist")) return { label: "Verified promotion mission", naira: 100, min: 80, max: 150 };
    return { label: "Standard participation mission", naira: 50, min: 40, max: 80 };
  }
  if (combined.includes("group") || combined.includes("community")) return { label: "Standard participation mission", naira: 70, min: 40, max: 80 };
  if (combined.includes("24") || combined.includes("story") || combined.includes("status")) return { label: "Standard participation mission", naira: 50, min: 40, max: 80 };
  return { label: "Simple awareness mission", naira: MIN_REWARD_NAIRA, min: MIN_REWARD_NAIRA, max: 40 };
}

function buildPricing(rewardNaira: number, contributors: number) {
  const reward = Math.max(MIN_REWARD_NAIRA, rewardNaira);
  const contributorRewards = reward * contributors;
  const commission = Math.round(contributorRewards * COMMISSION_RATE);
  const verification = Math.round(contributorRewards * VERIFICATION_RATE);
  const total = contributorRewards + commission + verification;

  return {
    rewardNaira: reward,
    rewardQlt: toQlt(reward),
    contributorRewards,
    contributorRewardsQlt: toQlt(contributorRewards),
    commission,
    verification,
    feeTotal: commission + verification,
    total,
    totalQlt: toQlt(total),
  };
}

type ContentRequirement = {
  mode: "link" | "upload" | "either";
  title: string;
  detail: string;
  linkLabel: string;
  linkHint: string;
  uploadHint: string;
};

function getContentRequirement(categoryId: string, contentType: string): ContentRequirement {
  const value = `${categoryId} ${contentType}`.toLowerCase();

  if (categoryId === "apps") {
    return {
      mode: "link",
      title: "App test link required",
      detail: "Add the exact app, build, prototype, or instruction link contributors must open before completing the test.",
      linkLabel: "Required app or test link",
      linkHint: "Use the Play Store, App Store, TestFlight, APK, web app, prototype, or testing instruction link.",
      uploadHint: "No file upload",
    };
  }

  if (categoryId === "feedback") {
    return {
      mode: "link",
      title: "Feedback context required",
      detail: "Add the survey, product page, content link, prototype, research brief, or form contributors must review.",
      linkLabel: "Required feedback link",
      linkHint: "Contributors will open this link, review the context, and submit their written response.",
      uploadHint: "No file upload",
    };
  }

  const needsLink = ["app", "android", "ios", "web app", "apk", "song link", "music video", "snippet", "video", "sound", "community", "group", "server", "survey", "feature validation", "review"].some((term) => value.includes(term));
  const needsUpload = ["flyer", "announcement", "offer"].some((term) => value.includes(term));

  if (value.includes("cover art")) {
    return {
      mode: "either",
      title: "Campaign content",
      detail: "Upload the cover art or paste a direct link contributors can open and use for the campaign.",
      linkLabel: "Cover art link",
      linkHint: "Use this if the cover art already lives online.",
      uploadHint: "Upload image, PDF, or use a link",
    };
  }

  if (needsLink && !needsUpload) {
    return {
      mode: "link",
      title: "Campaign link required",
      detail: "This content type needs a link contributors can open directly. File upload is hidden so the instruction stays clear.",
      linkLabel: "Required link",
      linkHint: "Contributors will open this link to complete the task.",
      uploadHint: "No file upload",
    };
  }

  if (needsUpload && !needsLink) {
    return {
      mode: "upload",
      title: "Campaign asset required",
      detail: "This content type needs an uploaded visual or document that contributors can use for the campaign.",
      linkLabel: "Optional supporting link",
      linkHint: "Add a link only if contributors need extra context.",
      uploadHint: "Images, PDF, or document only",
    };
  }

  return {
    mode: "either",
    title: "Campaign content",
    detail: "Upload the campaign material or add a link, depending on what contributors need to complete the task.",
    linkLabel: "Campaign link",
    linkHint: "Use this if the content already lives online.",
    uploadHint: "Upload a file or use a link",
  };
}

function getProofConfig(categoryId: string) {
  if (categoryId === "feedback") {
    return {
      type: "text",
      label: "Submit your written feedback response",
      maxScreenshots: 0,
    };
  }

  if (categoryId === "apps") {
    return {
      type: "screenshot",
      label: "Upload screenshots and describe what happened during the app test",
      maxScreenshots: 3,
    };
  }

  return {
    type: "screenshot",
    label: "Upload proof showing you completed the mission",
    maxScreenshots: 2,
  };
}

function formatMissingFields(fields: string[]) {
  if (fields.length <= 1) return fields[0] || "the missing details";
  if (fields.length === 2) return `${fields[0]} and ${fields[1]}`;
  return `${fields.slice(0, -1).join(", ")}, and ${fields[fields.length - 1]}`;
}

export default function NewCampaignPage() {
  const router = useRouter();
  const [business, setBusiness] = useState<Business | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [categoryId, setCategoryId] = useState("content");
  const [goal, setGoal] = useState(missionCategories[0].goals[0]);
  const [title, setTitle] = useState("");
  const [objective, setObjective] = useState("");
  const [contentType, setContentType] = useState(missionCategories[0].contentTypes[0]);
  const [contentCaption, setContentCaption] = useState("");
  const [contentLink, setContentLink] = useState("");
  const [assetName, setAssetName] = useState("");
  const [assetPreviewUrl, setAssetPreviewUrl] = useState("");
  const [assetDataUrl, setAssetDataUrl] = useState("");
  const [assetMimeType, setAssetMimeType] = useState("");
  const [bundleId, setBundleId] = useState("");
  const [selectedPricingIds, setSelectedPricingIds] = useState<string[]>([]);
  const [actions, setActions] = useState<string[]>(missionCategories[0].defaultActions);
  const [appContributorInstructions, setAppContributorInstructions] = useState("");
  const [audience, setAudience] = useState<string[]>(missionCategories[0].defaultAudience.slice(0, 2));
  const [selectedInterests, setSelectedInterests] = useState<string[]>(categoryInterestDefaults[missionCategories[0].id]);
  const [reachId, setReachId] = useState("starter");
  const [customContributors, setCustomContributors] = useState("");
  const [locationMode, setLocationMode] = useState<"nationwide" | "exact">("nationwide");
  const [targetLocations, setTargetLocations] = useState<TargetLocation[]>([]);
  const [locationSearchDraft, setLocationSearchDraft] = useState<TargetLocation>(createEmptyTargetLocation());
  const [focusedLocationIndex, setFocusedLocationIndex] = useState<number | null>(null);
  const [locationResults, setLocationResults] = useState<Record<number, LocationSearchResult[]>>({});
  const [locationSearchLoading, setLocationSearchLoading] = useState<Record<number, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [policyAccepted, setPolicyAccepted] = useState(false);
  const [success, setSuccess] = useState(false);
  const [draftReady, setDraftReady] = useState(false);
  const skipCategorySyncRef = useRef(false);
  const lastStepIndexRef = useRef(stepIndex);

  const category = useMemo(() => missionCategories.find((item) => item.id === categoryId) ?? missionCategories[0], [categoryId]);
  const selectedGoalInfo = useMemo(() => getGoalInfo(goal), [goal]);
  const recommendedBundles = useMemo(() => getRecommendedBundles(category.id, goal), [category.id, goal]);
  const bundle = useMemo(() => bundles.find((item) => item.id === bundleId) ?? null, [bundleId]);
  const reach = useMemo(() => reachPackages.find((item) => item.id === reachId) ?? reachPackages[0], [reachId]);
  const contributorCount = Math.max(1, Number(customContributors) || reach.contributors);
  const pricingChoices = useMemo(() => bundle ? getPricingOptions(category.id, bundle.id, goal) : [], [bundle, category.id, goal]);
  const selectedPricingOptions = useMemo(() => pricingChoices.filter((item) => selectedPricingIds.includes(item.id)), [pricingChoices, selectedPricingIds]);
  const selectedPricingLabel = summarizePricingOptions(selectedPricingOptions);
  const activeTargetLocations = useMemo(() => targetLocations.filter(isTargetLocationFilled), [targetLocations]);
  const locationSummary = locationMode === "nationwide"
    ? "Nationwide"
    : activeTargetLocations.map(summarizeTargetLocation).filter(Boolean).join(" + ");
  const locationStateTargets = activeTargetLocations
    .map(getStateTarget)
    .filter(Boolean);
  const reward = useMemo(() => {
    if (selectedPricingOptions.length > 0) {
      const rewardQlt = selectedPricingOptions.reduce((total, option) => total + option.rewardQlt, 0);
      const naira = qltToNaira(rewardQlt);
      return { label: selectedPricingLabel, naira, min: naira, max: naira };
    }
    return getRewardRecommendation(category.id, goal, bundle?.id ?? "", contentType);
  }, [bundle, category.id, contentType, goal, selectedPricingLabel, selectedPricingOptions]);
  const pricing = useMemo(() => buildPricing(reward.naira, contributorCount), [contributorCount, reward.naira]);
  const selectedPlatforms = selectedPricingOptions.length > 0 ? selectedPricingOptions.map((option) => option.platform) : (bundle?.platforms ?? []);
  const progress = Math.round(((stepIndex + 1) / steps.length) * 100);
  const heroCopy = stepHeroCopy[stepIndex] ?? stepHeroCopy[0];
  const contentRequirement = getContentRequirement(category.id, contentType);
  const proofConfig = getProofConfig(category.id);
  const acceptsUpload = contentRequirement.mode !== "link";
  const acceptsLink = contentRequirement.mode !== "upload";
  const hasUploadedAsset = assetName.trim().length > 0;
  const hasContentLink = contentLink.trim().length >= 3;
  const hasCampaignAsset = hasContentLink || hasUploadedAsset;
  const hasPricingSelection = Boolean(bundle && selectedPricingOptions.length > 0);
  const hasLocationTarget = locationMode === "nationwide" || activeTargetLocations.length > 0;
  const appInstructionSteps = appContributorInstructions
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);
  const hasContributorActions = category.id === "apps" ? appInstructionSteps.length > 0 : actions.length > 0;
  const missingLaunchFields = [
    title.trim().length >= 4 ? "" : "campaign title",
    objective.trim().length >= 10 ? "" : "campaign objective",
    hasCampaignAsset ? "" : "campaign link or attached asset",
    hasPricingSelection ? "" : "selected platform",
    hasContributorActions ? "" : category.id === "apps" ? "app test instructions" : "contributor action",
    hasLocationTarget ? "" : "target location",
    policyAccepted ? "" : "prohibited campaign confirmation",
  ].filter(Boolean);
  const canSubmit = missingLaunchFields.length === 0;
  const canContinueStep = (
    (stepIndex !== 2 || hasCampaignAsset)
    && (stepIndex !== 3 || hasPricingSelection)
    && (stepIndex !== 4 || category.id !== "apps" || appInstructionSteps.length > 0)
    && (stepIndex !== 5 || hasLocationTarget)
  );
  const hasEnoughBalance = Number(business?.balance ?? 0) >= pricing.totalQlt;
  const showWallet = stepIndex === steps.length - 1;
  const draftStorageKey = business ? `qeixova:campaign-builder-draft:${business.id}` : "";
  const hasDraftProgress = stepIndex > 0
    || categoryId !== missionCategories[0].id
    || title.trim().length > 0
    || objective.trim().length > 0
    || contentCaption.trim().length > 0
    || contentLink.trim().length > 0
    || assetName.trim().length > 0
    || bundleId.trim().length > 0
    || selectedPricingIds.length > 0
    || appContributorInstructions.trim().length > 0
    || customContributors.trim().length > 0
    || locationMode !== "nationwide"
    || targetLocations.length > 0;
  const shouldGuardExit = draftReady && hasDraftProgress && !success;

  const buildDraft = useCallback((savedAt = new Date().toISOString()): CampaignBuilderDraft => ({
    version: DRAFT_VERSION,
    savedAt,
    stepIndex,
    categoryId,
    goal,
    title,
    objective,
    contentType,
    contentCaption,
    contentLink,
    assetName,
    assetDataUrl,
    assetMimeType,
    bundleId,
    selectedPricingIds,
    actions,
    appContributorInstructions,
    audience,
    selectedInterests,
    reachId,
    customContributors,
    locationMode,
    targetLocations,
    locationSearchDraft,
  }), [
    actions,
    appContributorInstructions,
    assetDataUrl,
    assetMimeType,
    assetName,
    audience,
    bundleId,
    categoryId,
    contentCaption,
    contentLink,
    contentType,
    customContributors,
    goal,
    locationMode,
    locationSearchDraft,
    objective,
    reachId,
    selectedInterests,
    selectedPricingIds,
    stepIndex,
    targetLocations,
    title,
  ]);

  const saveDraft = useCallback(() => {
    if (!draftStorageKey) return;
    try {
      const savedAt = new Date().toISOString();
      window.localStorage.setItem(draftStorageKey, JSON.stringify(buildDraft(savedAt)));
    } catch {
      // Local storage can be unavailable in private or restricted browser modes.
    }
  }, [buildDraft, draftStorageKey]);

  const applyDraft = (draft: CampaignBuilderDraft) => {
    skipCategorySyncRef.current = true;
    setStepIndex(Math.min(Math.max(Number(draft.stepIndex) || 0, 0), steps.length - 1));
    setCategoryId(draft.categoryId || missionCategories[0].id);
    setGoal(draft.goal || missionCategories[0].goals[0]);
    setTitle(draft.title || "");
    setObjective(draft.objective || "");
    setContentType(draft.contentType || missionCategories[0].contentTypes[0]);
    setContentCaption(draft.contentCaption || "");
    setContentLink(draft.contentLink || "");
    setAssetName(draft.assetName || "");
    setAssetDataUrl(draft.assetDataUrl || "");
    setAssetPreviewUrl(draft.assetDataUrl || "");
    setAssetMimeType(draft.assetMimeType || "");
    setBundleId(draft.bundleId || "");
    setSelectedPricingIds(Array.isArray(draft.selectedPricingIds) ? draft.selectedPricingIds : []);
    setActions(Array.isArray(draft.actions) && draft.actions.length > 0 ? normalizeCampaignActions(draft.actions) : missionCategories[0].defaultActions);
    setAppContributorInstructions(draft.appContributorInstructions || "");
    setAudience(Array.isArray(draft.audience) ? draft.audience : missionCategories[0].defaultAudience.slice(0, 2));
    setSelectedInterests(Array.isArray(draft.selectedInterests) ? draft.selectedInterests : categoryInterestDefaults[missionCategories[0].id]);
    setReachId(draft.reachId || "starter");
    setCustomContributors(draft.customContributors || "");
    setLocationMode(draft.locationMode === "exact" ? "exact" : "nationwide");
    setTargetLocations(Array.isArray(draft.targetLocations) ? draft.targetLocations : []);
    setLocationSearchDraft(draft.locationSearchDraft ?? createEmptyTargetLocation());
    setError("");
  };

  useEffect(() => {
    fetch("/api/business/me")
      .then((res) => {
        if (!res.ok) {
          router.push("/business/login");
          return null;
        }
        return res.json();
      })
      .then((data) => {
        if (data?.business) setBusiness(data.business);
      })
      .catch(() => router.push("/business/login"));
  }, [router]);

  useEffect(() => {
    if (!draftStorageKey || draftReady) return;
    try {
      const raw = window.localStorage.getItem(draftStorageKey);
      if (raw) {
        const draft = JSON.parse(raw) as CampaignBuilderDraft;
        if (draft?.version === DRAFT_VERSION) applyDraft(draft);
      }
    } catch {
      setError("Saved draft could not be restored.");
    } finally {
      setDraftReady(true);
    }
  }, [draftReady, draftStorageKey]);

  useEffect(() => {
    if (skipCategorySyncRef.current) {
      skipCategorySyncRef.current = false;
      return;
    }
    const nextCategory = missionCategories.find((item) => item.id === categoryId) ?? missionCategories[0];
    setGoal(nextCategory.goals[0]);
    setContentType(nextCategory.contentTypes[0]);
    setActions(nextCategory.defaultActions);
    setAppContributorInstructions("");
    setAudience(nextCategory.defaultAudience.slice(0, 2));
    setSelectedInterests(categoryInterestDefaults[nextCategory.id] ?? []);
    setBundleId("");
    setSelectedPricingIds([]);
    setError("");
  }, [categoryId]);

  useEffect(() => {
    if (!draftReady || !draftStorageKey || success) return;
    if (!hasDraftProgress) return;

    const timeout = window.setTimeout(() => {
      saveDraft();
    }, DRAFT_SAVE_DELAY_MS);

    return () => window.clearTimeout(timeout);
  }, [draftReady, draftStorageKey, hasDraftProgress, saveDraft, success]);

  useEffect(() => {
    if (!shouldGuardExit) return;

    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      saveDraft();
      event.preventDefault();
      event.returnValue = "";
    };

    const onDocumentClick = (event: MouseEvent) => {
      const target = event.target as Element | null;
      const link = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!link) return;
      if (link.target === "_blank" || link.hasAttribute("download")) return;

      const destination = new URL(link.href, window.location.href);
      if (destination.href === window.location.href) return;

      saveDraft();
      const shouldLeave = window.confirm("Your campaign draft has been autosaved. Leave this page?");
      if (!shouldLeave) {
        event.preventDefault();
        event.stopPropagation();
      }
    };

    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onDocumentClick, true);

    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onDocumentClick, true);
    };
  }, [saveDraft, shouldGuardExit]);

  useEffect(() => {
    if (lastStepIndexRef.current === stepIndex) return;
    lastStepIndexRef.current = stepIndex;

    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "smooth" });
      document.scrollingElement?.scrollTo({ top: 0, behavior: "smooth" });
    });
  }, [stepIndex]);

  useEffect(() => {
    if (!assetPreviewUrl) return;
    return () => URL.revokeObjectURL(assetPreviewUrl);
  }, [assetPreviewUrl]);

  useEffect(() => {
    if (focusedLocationIndex === null) return;
    const query = locationSearchDraft.query?.trim() ?? "";
    if (query.length < 2) {
      setLocationResults((current) => ({ ...current, [focusedLocationIndex]: [] }));
      return;
    }

    let cancelled = false;
    setLocationSearchLoading((current) => ({ ...current, [focusedLocationIndex]: true }));
    const timeout = window.setTimeout(() => {
      fetch(`/api/locations/search?q=${encodeURIComponent(query)}`)
        .then((response) => response.ok ? response.json() : Promise.reject(new Error("Location search failed")))
        .then((data) => {
          if (!cancelled) {
            setLocationResults((current) => ({ ...current, [focusedLocationIndex]: data.locations ?? [] }));
          }
        })
        .catch(() => {
          if (!cancelled) setLocationResults((current) => ({ ...current, [focusedLocationIndex]: [] }));
        })
        .finally(() => {
          if (!cancelled) setLocationSearchLoading((current) => ({ ...current, [focusedLocationIndex]: false }));
        });
    }, 180);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [focusedLocationIndex, locationSearchDraft.query]);

  const handleAssetUpload = (file: File | undefined) => {
    if (!file) {
      setAssetName("");
      setAssetMimeType("");
      setAssetPreviewUrl("");
      setAssetDataUrl("");
      setError("");
      return;
    }

    if (file && file.size > MAX_STORED_ASSET_BYTES) {
      setAssetName("");
      setAssetMimeType("");
      setAssetPreviewUrl("");
      setAssetDataUrl("");
      setError("Upload a campaign asset under 2.5MB so it can be stored and shown to contributors.");
      return;
    }
    setError("");
    setAssetName(file.name);
    setAssetMimeType(file.type);
    setAssetPreviewUrl(URL.createObjectURL(file));
    setAssetDataUrl("");

    const reader = new FileReader();
    reader.onload = () => setAssetDataUrl(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => {
      setAssetDataUrl("");
      setError("The campaign asset could not be prepared. Try uploading the file again.");
    };
    reader.readAsDataURL(file);
  };

  const selectContentType = (nextContentType: string) => {
    setContentType(nextContentType);
    setError("");
  };

  const toggleAction = (action: string) => {
    setActions((current) => {
      if (VISIBILITY_ACTIONS.includes(action as typeof VISIBILITY_ACTIONS[number])) {
        return [...current.filter((item) => !VISIBILITY_ACTIONS.includes(item as typeof VISIBILITY_ACTIONS[number])), action];
      }
      return current.includes(action) ? current.filter((item) => item !== action) : [...current, action];
    });
  };

  const toggleInterest = (interest: string) => {
    setSelectedInterests((current) => current.includes(interest)
      ? current.filter((item) => item !== interest)
      : [...current, interest]);
  };

  const updateLocationQuery = (value: string) => {
    setLocationMode("exact");
    setLocationSearchDraft((current) => ({
      ...current,
      query: value,
      id: undefined,
      name: undefined,
      type: undefined,
      latitude: undefined,
      longitude: undefined,
      population: undefined,
      boundary: undefined,
    }));
    setFocusedLocationIndex(0);
    setError("");
  };

  const clearLocationSearch = () => {
    setLocationMode("exact");
    setLocationSearchDraft(createEmptyTargetLocation());
    setLocationResults((current) => ({ ...current, 0: [] }));
    setLocationSearchLoading((current) => ({ ...current, 0: false }));
    setFocusedLocationIndex(null);
    setError("");
  };

  const removeTargetLocation = (index: number) => {
    setTargetLocations((current) => current.filter((_, locationIndex) => locationIndex !== index));
    setFocusedLocationIndex(null);
    setError("");
  };

  const selectTargetLocation = (result: LocationSearchResult) => {
    if (targetLocations.some((location) => location.id === result.id)) {
      setError(`${result.name} is already selected.`);
      return;
    }

    const state = result.type === "region" ? result.name : result.region ?? "";
    const city = result.type === "city" || result.type === "locality" ? result.name : "";
    const selectedLocation: TargetLocation = {
        id: result.id,
        name: result.name,
        type: result.type,
        country: result.country,
        countryCode: result.countryCode,
        region: result.region,
        state,
        city,
        latitude: result.latitude,
        longitude: result.longitude,
        population: result.population,
        contributorCount: result.contributorCount,
        boundary: result.boundary,
        address: "",
        query: summarizeTargetLocation({ ...locationSearchDraft, name: result.name, region: result.region, country: result.country }),
    };

    setTargetLocations((current) => [...current, selectedLocation]);
    setLocationSearchDraft(createEmptyTargetLocation());
    setLocationResults((current) => ({ ...current, 0: [] }));
    setLocationSearchLoading((current) => ({ ...current, 0: false }));
    setFocusedLocationIndex(null);
    setError("");
  };

  const selectGoal = (nextGoal: string) => {
    setGoal(nextGoal);
    setBundleId("");
    setSelectedPricingIds([]);
    setContentType(category.contentTypes[0]);
    setActions(category.defaultActions);
    setAppContributorInstructions("");
    setSelectedInterests(categoryInterestDefaults[category.id] ?? []);
    setError("");
  };

  const selectBundle = (nextBundleId: string) => {
    const isUnselecting = bundleId === nextBundleId;
    if (isUnselecting) {
      setBundleId("");
      setSelectedPricingIds([]);
      setActions(category.defaultActions);
      if (category.id !== "apps") setAppContributorInstructions("");
      setError("");
      return;
    }
    setBundleId(nextBundleId);
    setSelectedPricingIds([]);
    setActions(category.defaultActions);
    if (category.id !== "apps") setAppContributorInstructions("");
    setError("");
  };

  const togglePricing = (option: PricingOption) => {
    setBundleId(option.bundleId);
    setSelectedPricingIds((current) => {
      const alreadySelected = current.includes(option.id);
      const nextIds = alreadySelected
        ? current.filter((id) => id !== option.id)
        : [...current, option.id];
      const nextOptions = pricingChoices.filter((choice) => nextIds.includes(choice.id));
      setActions(buildActionsForPricing(category.defaultActions, nextOptions));
      setError("");
      return nextIds;
    });
  };

  const nextStep = () => {
    if (stepIndex === 2 && !hasCampaignAsset) {
      setError("Add a campaign link or attach an asset before continuing.");
      return;
    }
    if (stepIndex === 3 && !hasPricingSelection) {
      setError("Select a bundle and at least one platform before continuing.");
      return;
    }
    if (stepIndex === 4 && category.id === "apps" && appInstructionSteps.length === 0) {
      setError("Write the app test instructions contributors should follow.");
      return;
    }
    if (stepIndex === 5 && !hasLocationTarget) {
      setError("Choose nationwide targeting or add the exact location you want to reach.");
      return;
    }
    setError("");
    setStepIndex((current) => Math.min(steps.length - 1, current + 1));
  };
  const previousStep = () => setStepIndex((current) => Math.max(0, current - 1));

  const submitCampaign = async () => {
    if (!hasEnoughBalance) {
      router.push("/business/wallet");
      return;
    }
    if (!canSubmit) {
      setError(`Add ${formatMissingFields(missingLaunchFields)} before launch.`);
      return;
    }
    if (assetName && !contentLink.trim() && !assetDataUrl) {
      setError("Please wait for the uploaded campaign asset to finish preparing before launch.");
      return;
    }
    if (!policyAccepted) {
      setError("Confirm this campaign does not involve scams, fake engagement, spam, harassment, illegal products, misleading claims, privacy violations, or prohibited activity.");
      return;
    }

    setSaving(true);
    setError("");
    const appGuidedSteps = [
      ...selectedPricingOptions.map((option) => option.actionHint),
      ...appInstructionSteps,
    ];
    const contributorSteps = buildContributorSteps({
      hasUploadedAsset: Boolean(assetName),
      hasContentLink: Boolean(contentLink.trim()),
      categoryId: category.id,
      actions,
      selectedPricingOptions,
      appGuidedSteps,
    });
    const instructions = [
      `Objective: ${objective.trim()}`,
      contentCaption.trim() ? `Content caption: ${contentCaption.trim()}` : "",
      assetName ? `Attached asset: ${assetName}` : "",
      contentLink.trim() ? `Campaign link: ${contentLink.trim()}` : "",
      `Bundle: ${bundle?.name ?? ""}`,
      selectedPricingLabel ? `Selected platform: ${selectedPricingLabel}` : "",
      `Platforms: ${selectedPlatforms.join(", ")}`,
      selectedInterests.length > 0 ? `Target interests: ${selectedInterests.join(", ")}` : "Target interests: Broad audience",
      `Target location: ${locationSummary}`,
      `Contributor actions: ${contributorSteps.join(" | ")}`,
      `Reward: ${pricing.rewardQlt.toLocaleString()} QLT per approved participation.`,
    ].join("\n");

    const payload = {
      title: title.trim(),
      category: category.apiCategory,
      reward: String(pricing.rewardQlt),
      duration: reach.duration,
      instructions,
      steps: contributorSteps,
      proof_type: proofConfig.type,
      proof_label: proofConfig.label,
      max_screenshots: proofConfig.maxScreenshots,
      task_link: contentLink.trim(),
      total_budget: String(pricing.totalQlt),
      target_completion_count: String(contributorCount),
      mission_type: category.missionType,
      verification_type: proofConfig.type,
      difficulty: category.missionType === "premium" ? "hard" : category.missionType === "participation" ? "medium" : "easy",
      min_level: audience.some((item) => item.includes("Premium") || item.includes("Verified")) ? 2 : 1,
      target_professions: audience,
      target_interests: selectedInterests,
      target_platforms: selectedPlatforms,
      target_age_ranges: [],
      target_genders: [],
      target_states: locationMode === "nationwide" ? [] : locationStateTargets,
      campaign_goal: goal,
      campaign_package: reach.name,
      campaign_metadata: {
        productBibleVersion: "participation-growth-v1",
        missionCategoryId: category.id,
        contentType,
        contentCaption: contentCaption.trim(),
        assetName,
        assetDataUrl,
        assetMimeType,
        contentLink: contentLink.trim(),
        bundleId: bundle?.id ?? null,
        selectedPricingIds: selectedPricingOptions.map((option) => option.id),
        selectedPricingLabel: selectedPricingLabel || null,
        selectedPricingOptions: selectedPricingOptions.map((option) => ({
          id: option.id,
          label: option.label,
          platform: option.platform,
          rewardQlt: option.rewardQlt,
          actionHint: option.actionHint,
        })),
        selectedPricingPlatforms: selectedPricingOptions.map((option) => option.platform),
        targetLocation: {
          mode: locationMode,
          locations: locationMode === "nationwide" ? [] : activeTargetLocations.map((location) => ({
            id: location.id ?? null,
            name: location.name ?? null,
            type: location.type ?? null,
            country: location.country.trim(),
            countryCode: location.countryCode ?? null,
            region: location.region ?? null,
            state: location.state.trim(),
            city: location.city.trim(),
            address: location.address.trim(),
            latitude: location.latitude ?? null,
            longitude: location.longitude ?? null,
            population: location.population ?? null,
            boundary: location.boundary ?? null,
            summary: summarizeTargetLocation(location),
          })),
          summary: locationSummary,
        },
        objective,
        audience,
        selectedInterests,
        appContributorInstructions: category.id === "apps" ? appContributorInstructions.trim() : null,
        pricing: {
          rewardTier: reward.label,
          rewardPerContributorNaira: pricing.rewardNaira,
          rewardPerContributorQlt: pricing.rewardQlt,
          contributorRewardsNaira: pricing.contributorRewards,
          platformCommissionNaira: pricing.commission,
          verificationFeeNaira: pricing.verification,
          totalCampaignCostNaira: pricing.total,
          totalCampaignCostQlt: pricing.totalQlt,
        },
      },
    };

    const res = await fetch("/api/business/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (res.ok) {
      if (draftStorageKey) window.localStorage.removeItem(draftStorageKey);
      setSuccess(true);
    } else {
      setError(data.error || "Campaign could not be launched.");
    }
    setSaving(false);
  };

  if (!business) {
    return (
      <BusinessLoading
        title="Loading campaign builder"
        detail="Preparing goals, platform bundles, proof rules, and launch checks."
      />
    );
  }

  if (success) {
    return (
      <>
        <BusinessSidebar name={business.name} />
        <main className="successShell">
          <section className="successPanel">
            <div className="successMark" aria-hidden="true">
              <Image src="/qeixova-icon.png" alt="" width={42} height={42} />
            </div>
            <div className="successCopy">
              <span className="successStatus">Submitted successfully</span>
              <p className="eyebrow">Campaign submitted</p>
              <h1>{title || selectedGoalInfo.titlePlaceholder}</h1>
              <p>Your campaign is now in review. Once approved, contributors will be able to participate and approved completions will be paid from the reserved campaign budget.</p>
            </div>
            <div className="successSummaryGrid" aria-label="Campaign submission summary">
              <article>
                <span>Status</span>
                <strong>Pending review</strong>
              </article>
              <article>
                <span>Review window</span>
                <strong>Up to 24 hours</strong>
              </article>
              <article>
                <span>Budget</span>
                <strong>Reserved</strong>
              </article>
            </div>
            <div className="successActions">
              <button type="button" className="primary" onClick={() => router.push("/business/tasks")}>View Campaigns</button>
              <button type="button" onClick={() => router.push("/business/tasks/new")}>Create Another</button>
            </div>
          </section>
        </main>
        <BusinessBottomNav />
        <style jsx>{pageStyles}</style>
      </>
    );
  }

  return (
    <>
      <BusinessSidebar name={business.name} />
      <main className="pageShell">
        <section className="heroBand">
          <div>
            <p className="eyebrow">{heroCopy.eyebrow}</p>
            <h1>{heroCopy.title}</h1>
            <p>{heroCopy.description}</p>
          </div>
          {showWallet && (
            <div className="walletCard">
              <span>Business wallet</span>
              <strong>{business.balance.toLocaleString()} QLT</strong>
              <small>{business.name}</small>
            </div>
          )}
        </section>

        <section className="builderLayout">
          <aside className="stepRail" aria-label="Campaign steps">
            <div className="progressHeader">
              <span>Step {stepIndex + 1} of {steps.length}</span>
              <strong>{progress}%</strong>
            </div>
            <div className="progressTrack"><span style={{ width: `${progress}%` }} /></div>
            {steps.map((step, index) => (
              <button
                key={step}
                type="button"
                className={index === stepIndex ? "step active" : index < stepIndex ? "step done" : "step"}
                onClick={() => index <= stepIndex && setStepIndex(index)}
                disabled={index > stepIndex}
              >
                <span>{index + 1}</span>
                {step}
              </button>
            ))}
          </aside>

          <section className="builderPanel">
            {stepIndex === 0 && (
              <StepSection eyebrow="Step 1" title="Select mission category" note="Start with the type of growth participation this campaign needs.">
                <div className="categoryGrid">
                  {visibleMissionCategories.map((item) => (
                    <button key={item.id} type="button" className={item.id === categoryId ? "choiceCard active" : "choiceCard"} onClick={() => setCategoryId(item.id)}>
                      <strong>{item.name}</strong>
                      <span>{item.description}</span>
                    </button>
                  ))}
                </div>
              </StepSection>
            )}

            {stepIndex === 1 && (
              <StepSection eyebrow="Step 2" title="Select campaign goal" note="The goal controls the recommended reward, actions, and verification path.">
                <div className="goalChecklist">
                  {category.goals.map((item) => (
                    <label key={item} className={goal === item ? "goalOption active" : "goalOption"}>
                      <input
                        type="checkbox"
                        checked={goal === item}
                        onChange={() => selectGoal(item)}
                      />
                      <span>
                        <strong>{item}</strong>
                        <small>{getGoalInfo(item).detail}</small>
                      </span>
                    </label>
                  ))}
                </div>
                <label className="fieldBlock">
                  Campaign title
                  <input value={title} onChange={(event) => setTitle(event.target.value)} placeholder={selectedGoalInfo.titlePlaceholder} />
                </label>
                <label className="fieldBlock">
                  Campaign objective
                  <textarea value={objective} onChange={(event) => setObjective(event.target.value)} placeholder="Describe what contributors should help you achieve." />
                </label>
              </StepSection>
            )}

            {stepIndex === 2 && (
              <StepSection eyebrow="Step 3" title="Attach campaign content" note="Add the exact content contributors will promote, test, join, review, or respond to.">
                <div className="pillGrid">
                  {category.contentTypes.map((item) => (
                    <button key={item} type="button" className={contentType === item ? "pill active" : "pill"} onClick={() => selectContentType(item)}>{item}</button>
                  ))}
                </div>
                <div className={acceptsUpload ? "assetPanel" : "assetPanel linkOnlyPanel"}>
                  <div>
                    <p className="eyebrow">{contentRequirement.title}</p>
                    <h3>{contentType}</h3>
                    <span>{contentRequirement.detail}</span>
                  </div>
                  {acceptsUpload ? (
                    <label className="uploadBox">
                      <input
                        type="file"
                        accept="image/*,.pdf,.doc,.docx"
                        onChange={(event) => handleAssetUpload(event.target.files?.[0])}
                      />
                      <strong>{assetName || "Choose campaign asset"}</strong>
                      <small>{contentRequirement.uploadHint}</small>
                    </label>
                  ) : (
                    <div className="linkBadge">
                      <strong>Add link</strong>
                      <small>{contentRequirement.uploadHint}</small>
                    </div>
                  )}
                </div>
                {acceptsLink && (
                  <label className="fieldBlock">
                    {category.contentLabel} <small>{contentRequirement.linkLabel}</small>
                    <input value={contentLink} onChange={(event) => setContentLink(event.target.value)} placeholder="Add link of the content or campaign" />
                    <span className="fieldHelp">{contentRequirement.linkHint}</span>
                  </label>
                )}
                <label className="fieldBlock captionField">
                  Content caption <small>Optional</small>
                  <textarea
                    value={contentCaption}
                    onChange={(event) => setContentCaption(event.target.value)}
                    placeholder="Write the caption, message, hashtags, or post text contributors should use with this content."
                    rows={4}
                    maxLength={1200}
                  />
                  <span className="fieldHelp">{contentCaption.trim().length.toLocaleString()}/1,200 characters. Contributors will see this before the action steps.</span>
                </label>
                {!acceptsLink && contentLink && (
                  <div className="fieldNotice">
                    <div>
                      <strong>Supporting link saved</strong>
                      <span>{contentLink}</span>
                    </div>
                    <button type="button" onClick={() => setContentLink("")}>Remove</button>
                  </div>
                )}
              </StepSection>
            )}

            {stepIndex === 3 && (
              <StepSection eyebrow="Step 4" title="Choose bundle and platform" note="Pick a bundle, then check one or more platforms inside that bundle.">
                <div className="bundleGrid">
                  {recommendedBundles.map((item) => {
                    const itemPricing = getPricingOptions(category.id, item.id, goal);
                    const isActive = item.id === bundleId;
                    const itemDisplay = getBundleDisplay(item, category.id);
                    return (
                      <div key={item.id} className={isActive ? "bundleCard active" : "bundleCard"}>
                        <button type="button" className="bundleSelectButton" onClick={() => selectBundle(item.id)}>
                          <strong>{itemDisplay.name}</strong>
                          <span>{itemDisplay.description}</span>
                          <small>{itemDisplay.platforms.join(" / ")}</small>
                        </button>
                        {isActive && (
                          <div className="bundlePricingList">
                            <p className="eyebrow">Selectable platforms</p>
                            {itemPricing.length > 0 ? itemPricing.map((option) => (
                              <label key={option.id} className={selectedPricingIds.includes(option.id) ? "pricingCheck active" : "pricingCheck"}>
                                <input
                                  type="checkbox"
                                  checked={selectedPricingIds.includes(option.id)}
                                  onChange={() => togglePricing(option)}
                                />
                                <span>
                                  <strong>{option.label}</strong>
                                  <small>{option.platform}</small>
                                </span>
                                <em>{option.rewardQlt.toLocaleString()} QLT</em>
                              </label>
                            )) : (
                              <p className="emptyPricing">No fixed platform option is configured for this bundle yet.</p>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {recommendedBundles.length === 0 && (
                  <p className="emptyPricing">No recommended bundle is available for this goal yet.</p>
                )}
                {!hasPricingSelection && (
                  <p className="errorText compact">Select a bundle and at least one platform before continuing.</p>
                )}
              </StepSection>
            )}

            {stepIndex === 4 && (
              <StepSection eyebrow="Step 5" title="Confirm actions and reach" note="Set what contributors must do and how many people should complete the campaign.">
                {category.id === "apps" ? (
                  <div className="appInstructionPanel">
                    <header className="appInstructionTop">
                      <div>
                        <p className="inlineSectionTitle">Contributor checklist</p>
                        <h3>What should testers do?</h3>
                      </div>
                      <span>{appInstructionSteps.length > 0 ? `${appInstructionSteps.length} steps added` : "Required"}</span>
                    </header>
                    <p className="appInstructionCopy">Enter the exact actions contributors must complete. Use one line per step so the mission is easy to follow.</p>
                    <label className="appInstructionEditor">
                      <textarea
                        value={appContributorInstructions}
                        onChange={(event) => {
                          setAppContributorInstructions(event.target.value);
                          setError("");
                        }}
                        placeholder={"Install the app and create an account\nOpen the wallet page and test the fund button\nTake screenshots of each completed step\nWrite what worked, what failed, and what confused you"}
                      />
                      <small>Each line becomes a separate contributor step.</small>
                    </label>
                    <div className="appTestSummary">
                      <span>Selected test path</span>
                      <strong>{selectedPricingOptions.map((option) => option.label).join(" + ") || "No test path selected"}</strong>
                    </div>
                  </div>
                ) : (
                  <div className="checkGrid">
                    {getActionChoices(actions).map((item) => (
                      <label key={item} className={actions.includes(item) ? "checkItem active" : "checkItem"}>
                        <input
                          type={VISIBILITY_ACTIONS.includes(item as typeof VISIBILITY_ACTIONS[number]) ? "radio" : "checkbox"}
                          name={VISIBILITY_ACTIONS.includes(item as typeof VISIBILITY_ACTIONS[number]) ? "visibility-duration" : undefined}
                          checked={actions.includes(item)}
                          onChange={() => toggleAction(item)}
                        />
                        <span>{item}</span>
                      </label>
                    ))}
                  </div>
                )}
                <div className="sectionDivider" />
                <p className="inlineSectionTitle">Reach package</p>
                <div className="packageGrid">
                  {reachPackages.map((item) => (
                    <button key={item.id} type="button" className={item.id === reachId ? "packageCard active" : "packageCard"} onClick={() => setReachId(item.id)}>
                      <strong>{item.name}</strong>
                      <span>{item.contributors.toLocaleString()} contributors</span>
                      <small>{item.duration}</small>
                    </button>
                  ))}
                </div>
                <label className="fieldBlock compact">
                  Custom contributor quantity
                  <input type="number" min="1" value={customContributors} onChange={(event) => setCustomContributors(event.target.value)} placeholder="Use package quantity" />
                </label>
              </StepSection>
            )}

            {stepIndex === 5 && (
              <StepSection eyebrow="Step 6" title="Target people and location" note="Choose the interests and location that make this campaign feel like real human participation.">
                <div className="interestTargeting">
                  <div>
                    <p className="inlineSectionTitle">Contributor interests</p>
                    <span>Select interests that match the people most likely to understand, share, test, or respond to this campaign.</span>
                  </div>
                  <details className="interestDropdown">
                    <summary>
                      <span className="interestDropdownCopy">
                        <span>Interest profile</span>
                        <strong>{selectedInterests.length > 0 ? selectedInterests.slice(0, 3).join(", ") : "Broad audience"}</strong>
                      </span>
                      <span className="interestDropdownMeta">
                        <span>{selectedInterests.length > 0 ? `${selectedInterests.length} selected` : "Optional"}</span>
                        <i aria-hidden="true" />
                      </span>
                    </summary>
                    <div className="interestDropdownPanel">
                      {interestOptions.map((interest) => (
                        <label key={interest} className={selectedInterests.includes(interest) ? "dropdownCheck active" : "dropdownCheck"}>
                          <input type="checkbox" checked={selectedInterests.includes(interest)} onChange={() => toggleInterest(interest)} />
                          <span>{interest}</span>
                        </label>
                      ))}
                    </div>
                  </details>
                </div>
                <div className="sectionDivider" />
                <div className="locationTargeting">
                  <div className="locationTargetingHead">
                    <div>
                      <p className="inlineSectionTitle">Location targeting</p>
                      <span>{locationSummary}</span>
                    </div>
                    <strong>{locationMode === "nationwide" ? "Nationwide reach" : "Specific area"}</strong>
                  </div>
                  <div className="locationModeGrid">
                    <button type="button" className={locationMode === "nationwide" ? "locationMode active" : "locationMode"} onClick={() => setLocationMode("nationwide")}>
                      <span className="locationModeIcon">NG</span>
                      <strong>Nationwide</strong>
                      <span>Open this campaign to contributors across the country.</span>
                    </button>
                    <button type="button" className={locationMode === "exact" ? "locationMode active" : "locationMode"} onClick={() => setLocationMode("exact")}>
                      <span className="locationModeIcon">PIN</span>
                      <strong>Exact location</strong>
                      <span>Target a state, city, address, or business service area.</span>
                    </button>
                  </div>

                  {locationMode === "exact" && (
                    <div className="locationGrid">
                      {[locationSearchDraft].map((location, index) => {
                        const results = locationResults[index] ?? [];
                        const suggestionId = `locationSuggestions-${index}`;
                        const selectedMeta = "";

                        return (
                          <div key={index} className="locationSlot">
                            <div className="locationSlotHead">
                              <strong>Search and add locations</strong>
                              <span>{activeTargetLocations.length > 0 ? `${activeTargetLocations.length} selected` : "Required"}</span>
                            </div>
                            <div className="fieldBlock stateField locationField locationSearchField">
                              <label htmlFor={`targetLocation-${index}`}>Search location</label>
                              <input
                                id={`targetLocation-${index}`}
                                value={location.query ?? summarizeTargetLocation(location)}
                                onChange={(event) => updateLocationQuery(event.target.value)}
                                onFocus={() => setFocusedLocationIndex(index)}
                                onBlur={() => window.setTimeout(() => setFocusedLocationIndex((current) => current === index ? null : current), 120)}
                                placeholder="Start typing, e.g. Lagos or Ikeja"
                                autoComplete="off"
                                aria-autocomplete="list"
                                aria-controls={suggestionId}
                              />
                              {focusedLocationIndex === index && results.length > 0 && (
                                <div id={suggestionId} className="stateSuggestions" role="listbox">
                                  {results.map((result) => (
                                    <button
                                      key={result.id}
                                      type="button"
                                      role="option"
                                      aria-selected={location.id === result.id}
                                      onMouseDown={(event) => {
                                        event.preventDefault();
                                        selectTargetLocation(result);
                                      }}
                                    >
                                      <strong>{result.name}</strong>
                                      <span>{[result.type.replace("_", " "), result.region, result.country].filter(Boolean).join(" · ")}</span>
                                      <small>{result.contributorCount.toLocaleString()} contributor{result.contributorCount === 1 ? "" : "s"} in this state</small>
                                    </button>
                                  ))}
                                </div>
                              )}
                              {locationSearchLoading[index] ? <small>Searching location database...</small> : null}
                              {!locationSearchLoading[index] && (location.query?.trim().length ?? 0) > 1 && focusedLocationIndex === index && results.length === 0 ? (
                                <small>No match yet. Try a city, state, neighborhood, or country.</small>
                              ) : null}
                            </div>
                            {location.id && (
                              <div className="locationGeoCard">
                                <span>{location.type?.replace("_", " ") ?? "location"}</span>
                                <strong>{summarizeTargetLocation(location)}</strong>
                                <small>
                                  {[
                                    selectedMeta,
                                    typeof location.contributorCount === "number" ? `${location.contributorCount.toLocaleString()} contributors in this state` : "",
                                    location.population ? `${location.population.toLocaleString()} people est.` : "",
                                    location.boundary ? `${location.boundary.type.toUpperCase()} boundary` : "",
                                  ].filter(Boolean).join(" · ")}
                                </small>
                              </div>
                            )}
                          </div>
                        );
                      })}
                      {activeTargetLocations.length > 0 && (
                        <div className="selectedLocationList">
                          {activeTargetLocations.map((location, index) => {
                            const selectedMeta = "";

                            return (
                              <div key={location.id ?? `${summarizeTargetLocation(location)}-${index}`} className="locationGeoCard">
                                <span>{location.type?.replace("_", " ") ?? "location"}</span>
                                <strong>{summarizeTargetLocation(location)}</strong>
                                <small>
                                  {[
                                    selectedMeta,
                                    typeof location.contributorCount === "number" ? `${location.contributorCount.toLocaleString()} contributors in this state` : "",
                                    location.population ? `${location.population.toLocaleString()} people est.` : "",
                                    location.boundary ? `${location.boundary.type.toUpperCase()} boundary` : "",
                                  ].filter(Boolean).join(" - ")}
                                </small>
                                <button type="button" className="removeLocationButton" onClick={() => removeTargetLocation(index)}>
                                  Remove
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      )}
                      {activeTargetLocations.length > 0 && (
                        <button type="button" className="addLocationButton" onClick={clearLocationSearch}>
                          Search another location
                        </button>
                      )}
                    </div>
                  )}
                </div>

                <div className="locationSummary">
                  <span>Target location</span>
                  <strong>{locationSummary || "Add a location"}</strong>
                </div>
                <div className="locationSummary interestSummary">
                  <span>Target interests</span>
                  <strong>{selectedInterests.length > 0 ? selectedInterests.join(", ") : "Broad audience"}</strong>
                </div>
              </StepSection>
            )}

            {stepIndex === 6 && (
              <StepSection eyebrow="Step 7" title="Preview campaign" note="This is what the business and contributor experience are built from.">
                <CampaignPreview
                  title={title || selectedGoalInfo.titlePlaceholder}
                  objective={objective || selectedGoalInfo.detail}
                  goal={goal}
                  bundleName={bundle?.name ?? "No bundle selected"}
                  selectedPlatforms={selectedPlatforms}
                  selectedPlatformLabel={selectedPricingLabel || "No platform selected"}
                  actions={actions}
                  selectedInterests={selectedInterests}
                  locationSummary={locationSummary}
                  contentType={contentType}
                  contentCaption={contentCaption}
                  contentLink={contentLink}
                  assetName={assetName}
                  assetPreviewUrl={assetPreviewUrl}
                  assetMimeType={assetMimeType}
                  contributorCount={contributorCount}
                  duration={reach.duration}
                  totalCostQlt={pricing.totalQlt}
                  contributorRewardsQlt={pricing.contributorRewardsQlt}
                  qeixovaCommissionQlt={toQlt(pricing.commission)}
                  verificationFeeQlt={toQlt(pricing.verification)}
                  balanceQlt={business.balance}
                  proofLabel={proofConfig.label}
                  ready={canSubmit}
                  onBack={() => setStepIndex(5)}
                  onEditGoal={() => setStepIndex(1)}
                  onChangeContent={() => setStepIndex(2)}
                  onChangePlatforms={() => setStepIndex(3)}
                  onViewLocation={() => setStepIndex(5)}
                  onChangePackage={() => setStepIndex(4)}
                />
              </StepSection>
            )}

            {error && <p className="errorText">{error}</p>}

            {stepIndex === steps.length - 1 && (
              <label className="policyConfirmBox">
                <input
                  type="checkbox"
                  checked={policyAccepted}
                  onChange={(event) => {
                    setPolicyAccepted(event.target.checked);
                    if (event.target.checked) setError("");
                  }}
                />
                <span>
                  I confirm that this campaign does not involve scams, fake engagement, spam, harassment, illegal products, misleading claims, privacy violations, or prohibited activity. I agree to the <a href="/prohibited-campaign-policy" target="_blank" rel="noopener noreferrer">Prohibited Campaign Policy</a>.
                </span>
              </label>
            )}

            <div className="actionsBar">
              <button type="button" className="secondaryButton" onClick={previousStep} disabled={stepIndex === 0}>Back</button>
              {stepIndex < steps.length - 1 ? (
                <button type="button" className="primaryButton" onClick={nextStep} disabled={!canContinueStep}>Continue</button>
              ) : (
                <button type="button" className="primaryButton" disabled={saving} onClick={submitCampaign}>
                  {saving ? "Processing..." : hasEnoughBalance ? "Payment" : "Add funds"}
                </button>
              )}
            </div>
          </section>

        </section>
      </main>
      <BusinessBottomNav />
      <style jsx>{pageStyles}</style>
    </>
  );
}

function StepSection({ eyebrow, title, note, children }: { eyebrow: string; title: string; note: string; children: React.ReactNode }) {
  return (
    <div className="stepSection">
      <div className="sectionHeader">
        <p className="eyebrow">{eyebrow}</p>
        <h2>{title}</h2>
        <span>{note}</span>
      </div>
      {children}
    </div>
  );
}

function CampaignPreview({
  title,
  objective,
  goal,
  bundleName,
  selectedPlatforms,
  selectedPlatformLabel,
  actions,
  selectedInterests,
  locationSummary,
  contentType,
  contentCaption,
  contentLink,
  assetName,
  assetPreviewUrl,
  assetMimeType,
  contributorCount,
  duration,
  totalCostQlt,
  contributorRewardsQlt,
  qeixovaCommissionQlt,
  verificationFeeQlt,
  balanceQlt,
  proofLabel,
  ready,
  onBack,
  onEditGoal,
  onChangeContent,
  onChangePlatforms,
  onViewLocation,
  onChangePackage,
}: {
  title: string;
  objective: string;
  goal: string;
  bundleName: string;
  selectedPlatforms: string[];
  selectedPlatformLabel: string;
  actions: string[];
  selectedInterests: string[];
  locationSummary: string;
  contentType: string;
  contentCaption: string;
  contentLink: string;
  assetName: string;
  assetPreviewUrl: string;
  assetMimeType: string;
  contributorCount: number;
  duration: string;
  totalCostQlt: number;
  contributorRewardsQlt: number;
  qeixovaCommissionQlt: number;
  verificationFeeQlt: number;
  balanceQlt: number;
  proofLabel: string;
  ready: boolean;
  onBack: () => void;
  onEditGoal: () => void;
  onChangeContent: () => void;
  onChangePlatforms: () => void;
  onViewLocation: () => void;
  onChangePackage: () => void;
}) {
  const [showBudgetBreakdown, setShowBudgetBreakdown] = useState(false);
  const visiblePlatforms = selectedPlatforms.length > 0 ? selectedPlatforms : ["No platform selected"];
  const currentBalance = Number(balanceQlt ?? 0);
  const balanceAfter = currentBalance - totalCostQlt;
  const fundingGap = Math.max(0, totalCostQlt - currentBalance);
  const hasEnoughBalance = balanceAfter >= 0;
  const assetSource = contentLink || (assetName ? "Uploaded campaign asset" : contentType);
  const isImageAsset = assetPreviewUrl && assetMimeType.startsWith("image/");
  const shownActions = actions;

  return (
    <div className="campaignPreview">
      <div className="previewTopbar">
        <button type="button" className="previewTextButton muted" onClick={onBack}>Back</button>
        <strong>Campaign Preview</strong>
        <button type="button" className="previewTextButton" onClick={onEditGoal}>Edit</button>
      </div>

      <section className="previewHeroCard">
        <div className="previewHeroCopy">
          <span className={ready ? "previewStatus ready" : "previewStatus"}>{ready ? "Ready to launch" : "Needs setup"}</span>
          <h3>{title}</h3>
          <p>{objective}</p>
          {contentCaption.trim() ? (
            <div className="previewCaptionBox">
              <strong>Caption for contributors</strong>
              <span>{contentCaption.trim()}</span>
            </div>
          ) : null}
          <div className="previewGoalLine">
            <strong>Goal</strong>
            <span>{goal}</span>
          </div>
        </div>
        <div className="previewAssetCard">
          {isImageAsset ? (
            <img src={assetPreviewUrl} alt="Campaign content preview" />
          ) : (
            <span>{contentType.slice(0, 2).toUpperCase()}</span>
          )}
          <strong>{assetSource}</strong>
          {assetName && !contentLink ? null : (
            <small>{contentLink ? "Linked campaign asset" : "Campaign asset preview"}</small>
          )}
          <button type="button" className="previewAssetButton" onClick={onChangeContent}>Change content</button>
        </div>
      </section>

      <section className="previewSection">
        <div className="previewSectionHead">
          <h3>Distribution platforms</h3>
          <button type="button" className="previewPillButton" onClick={onChangePlatforms}>{visiblePlatforms.length} selected</button>
        </div>
        <div className="previewPlatformGrid">
          {visiblePlatforms.map((platform, index) => (
            <article key={`${platform}-${index}`} className="previewPlatformCard">
              <span>{platform.slice(0, 1).toUpperCase()}</span>
              <strong>{platform}</strong>
              <small>{index === 0 ? "Primary" : "Selected"}</small>
            </article>
          ))}
        </div>
      </section>

      <section className="previewSection">
        <div className="previewSectionHead">
          <h3>Contributors will</h3>
          <button type="button" className="previewPillButton" onClick={onChangePackage}>{shownActions.length} selected</button>
        </div>
        <div className="previewActionGrid">
          {shownActions.length > 0 ? shownActions.map((action) => (
            <div key={action} className="previewActionItem">
              <p>{action}</p>
            </div>
          )) : (
            <div className="previewActionItem">
              <p>No contributor actions selected.</p>
            </div>
          )}
        </div>
      </section>

      <section className="previewSection">
        <div className="previewSectionHead">
          <h3>Target audience</h3>
          <button type="button" className="previewPillButton" onClick={onViewLocation}>View details</button>
        </div>
        <div className="previewAudienceGrid">
          <article><strong>Interests</strong><span>{selectedInterests.length > 0 ? selectedInterests.join(", ") : "Broad audience"}</span></article>
          <article><strong>Location</strong><span>{locationSummary}</span></article>
          <article><strong>Quality</strong><span>{proofLabel}</span></article>
        </div>
      </section>

      <section className="previewFooterGrid">
        <article className="previewSection">
          <div className="previewSectionHead">
            <h3>Campaign package and duration</h3>
            <button type="button" className="previewPillButton" onClick={onChangePackage}>Change</button>
          </div>
          <div className="previewSplit">
            <div><strong>{bundleName}</strong><span>{selectedPlatformLabel}</span></div>
            <div><strong>{duration}</strong><span>{contributorCount.toLocaleString()} contributors</span></div>
          </div>
        </article>
        <article className="previewSection">
          <div className="previewSectionHead">
            <h3>Budget summary</h3>
            <button
              type="button"
              className="previewPillButton"
              aria-expanded={showBudgetBreakdown}
              aria-controls="preview-budget-breakdown"
              onClick={() => setShowBudgetBreakdown((current) => !current)}
            >
              {showBudgetBreakdown ? "Hide breakdown" : "View breakdown"}
            </button>
          </div>
          <div className="previewSplit">
            <div><strong>{totalCostQlt.toLocaleString()} QLT</strong><span>Total campaign cost</span></div>
            <div className={hasEnoughBalance ? "" : "fundingRequired"}>
              <strong>{hasEnoughBalance ? `${balanceAfter.toLocaleString()} QLT` : `${fundingGap.toLocaleString()} QLT`}</strong>
              <span>{hasEnoughBalance ? "Balance after launch" : "Add funds required"}</span>
            </div>
          </div>
          {!hasEnoughBalance && (
            <div className="fundingHint" role="status" aria-live="polite">
              <div>
                <span>Wallet funding required</span>
                <strong>Top up {fundingGap.toLocaleString()} QLT to launch this campaign.</strong>
              </div>
              <small>Current balance: {currentBalance.toLocaleString()} QLT</small>
            </div>
          )}
          {showBudgetBreakdown && (
            <div id="preview-budget-breakdown" className="previewBudgetBreakdown" aria-label="Campaign budget breakdown">
              <div><span>Contributor reward</span><strong>{contributorRewardsQlt.toLocaleString()} QLT</strong></div>
              <div><span>Qeixova commission</span><strong>{qeixovaCommissionQlt.toLocaleString()} QLT</strong></div>
              <div><span>Verification fee</span><strong>{verificationFeeQlt.toLocaleString()} QLT</strong></div>
            </div>
          )}
        </article>
      </section>
    </div>
  );
}

const pageStyles = `
  :global(body) {
    background: #070808;
    color: #f7f7f7;
    font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
  }

  .loadingShell,
  .successShell,
  .pageShell {
    min-height: 100vh;
    padding: 24px 24px 104px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, .025), transparent 340px),
      #070808;
  }

  .loadingShell {
    display: grid;
    place-items: center;
    color: #b8b8b8;
  }

  .successShell {
    display: grid;
    place-items: center;
  }

  .successPanel {
    width: min(720px, 100%);
    display: grid;
    gap: 20px;
    justify-items: center;
    text-align: center;
    border: 1px solid #252a28;
    background:
      radial-gradient(circle at 50% 0%, rgba(245, 166, 35, .14), transparent 36%),
      linear-gradient(180deg, #111312, #080909);
    border-radius: 12px;
    padding: 34px;
    box-shadow: 0 18px 60px rgba(0, 0, 0, .34);
  }

  .successMark {
    width: 64px;
    height: 64px;
    display: grid;
    place-items: center;
    border: 1px solid rgba(245, 166, 35, .34);
    border-radius: 18px;
    background: rgba(245, 166, 35, .1);
    box-shadow: 0 16px 40px rgba(245, 166, 35, .1);
  }

  .successMark img {
    border-radius: 12px;
  }

  .successCopy {
    display: grid;
    gap: 8px;
    justify-items: center;
  }

  .successStatus {
    display: inline-flex;
    align-items: center;
    min-height: 30px;
    border: 1px solid rgba(245, 166, 35, .28);
    border-radius: 999px;
    background: rgba(245, 166, 35, .1);
    color: #f5a623;
    padding: 0 12px;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .successPanel h1 {
    margin: 0;
    max-width: 620px;
    font-size: clamp(28px, 4vw, 40px);
    line-height: 1.08;
  }

  .successPanel p {
    max-width: 610px;
    margin: 0;
    color: #bdbdbd;
    line-height: 1.7;
  }

  .successSummaryGrid {
    width: 100%;
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .successSummaryGrid article {
    display: grid;
    gap: 6px;
    min-height: 90px;
    align-content: center;
    border: 1px solid #202423;
    border-radius: 10px;
    background: #0b0d0c;
    padding: 14px;
    text-align: left;
  }

  .successSummaryGrid span {
    color: #8f9692;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .successSummaryGrid strong {
    color: #f5f5f5;
    font-size: 15px;
    line-height: 1.25;
  }

  .successActions {
    width: 100%;
    display: flex;
    justify-content: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-top: 2px;
  }

  .successActions button,
  .primaryButton,
  .secondaryButton {
    border: 0;
    border-radius: 10px;
    padding: 13px 18px;
    font-weight: 900;
    cursor: pointer;
    transition: transform .16s ease, box-shadow .16s ease, border-color .16s ease, background .16s ease;
  }

  .successActions .primary,
  .primaryButton {
    background: #f5a623;
    color: #050505;
    box-shadow: 0 12px 24px rgba(245, 166, 35, .18);
  }

  .successActions button,
  .secondaryButton {
    background: #111312;
    color: #f8f8f8;
    border: 1px solid #252a28;
  }

  .primaryButton:hover,
  .secondaryButton:hover,
  .successActions button:hover {
    transform: translateY(-1px);
  }

  @keyframes campaignFadeUp {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes campaignRailWake {
    0%,
    100% {
      border-color: #202322;
      box-shadow: 0 16px 48px rgba(0, 0, 0, .24);
    }
    50% {
      border-color: rgba(245, 166, 35, .34);
      box-shadow: 0 18px 58px rgba(245, 166, 35, .08);
    }
  }

  .primaryButton:disabled,
  .secondaryButton:disabled {
    opacity: .45;
    cursor: not-allowed;
  }

  .heroBand {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 16px;
    align-items: start;
    margin-bottom: 18px;
    max-width: 1360px;
  }

  .heroBand > div:first-child,
  .walletCard,
  .builderPanel,
  .stepRail {
    background: linear-gradient(180deg, #111312, #0a0b0b);
    border: 1px solid #252a28;
    border-radius: 10px;
    box-shadow: 0 16px 48px rgba(0, 0, 0, .24);
  }

  .heroBand > div:first-child {
    padding: 28px 32px;
    position: relative;
    overflow: hidden;
    animation: campaignFadeUp .42s ease both;
  }

  .heroBand h1 {
    margin: 6px 0 12px;
    max-width: 760px;
    font-size: clamp(34px, 3.1vw, 48px);
    line-height: 1.08;
    letter-spacing: 0;
  }

  .heroBand p:not(.eyebrow) {
    max-width: 740px;
    color: #bdbdbd;
    line-height: 1.65;
    margin: 0;
  }

  .walletCard {
    padding: 20px;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: 8px;
    border-color: rgba(245, 166, 35, .28);
    background: #12100c;
    min-height: 156px;
    animation: campaignFadeUp .46s ease .04s both;
  }

  .walletCard span,
  .walletCard small,
  .sectionHeader span,
  .choiceCard span,
  .bundleCard span,
  .bundleCard small,
  .packageCard span,
  .packageCard small {
    color: #a8a8a8;
  }

  .walletCard strong {
    font-size: 28px;
    letter-spacing: 0;
  }

  .builderLayout {
    display: grid;
    grid-template-columns: 240px minmax(560px, 1fr);
    gap: 16px;
    align-items: start;
    max-width: 1360px;
  }

  .stepRail {
    padding: 14px;
    position: sticky;
    top: 20px;
    animation: campaignFadeUp .44s ease .06s both, campaignRailWake 7s ease-in-out infinite;
  }

  .progressHeader {
    display: flex;
    justify-content: space-between;
    color: #bdbdbd;
    font-size: 12px;
    font-weight: 800;
  }

  .progressTrack {
    height: 7px;
    background: #171717;
    border-radius: 99px;
    overflow: hidden;
    margin: 12px 0 16px;
  }

  .progressTrack span {
    display: block;
    height: 100%;
    background: #f5a623;
  }

  .step {
    width: 100%;
    border: 1px solid transparent;
    background: transparent;
    color: #a8a8a8;
    display: flex;
    align-items: center;
    gap: 9px;
    padding: 11px 10px;
    border-radius: 8px;
    cursor: pointer;
    font-weight: 800;
    text-align: left;
  }

  .step:disabled {
    opacity: .5;
    cursor: not-allowed;
  }

  .step span {
    width: 24px;
    height: 24px;
    display: inline-grid;
    place-items: center;
    border-radius: 50%;
    background: #171717;
    color: #d8d8d8;
    font-size: 12px;
  }

  .step.active {
    border-color: #f5a623;
    color: #fff;
    background: rgba(245, 166, 35, .11);
  }

  .step.done span {
    background: #1aef22;
    color: #041004;
  }

  .builderPanel {
    min-height: 660px;
    padding: 26px;
    overflow: hidden;
    animation: campaignFadeUp .48s ease .1s both;
  }

  .stepSection {
    display: grid;
    gap: 20px;
  }

  .sectionHeader {
    display: grid;
    gap: 7px;
    border: 1px solid #202423;
    border-radius: 10px;
    background:
      linear-gradient(135deg, rgba(245, 166, 35, .08), transparent 44%),
      #0b0d0c;
    padding: 16px;
  }

  .sectionHeader h2 {
    margin: 0;
    font-size: 30px;
    line-height: 1.12;
    letter-spacing: 0;
  }

  .sectionHeader span {
    line-height: 1.55;
  }

  .eyebrow {
    margin: 0;
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: 0;
  }

  .categoryGrid,
  .bundleGrid,
  .packageGrid,
  .locationModeGrid,
  .locationGrid,
  .previewGrid,
  .launchGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }

  .choiceCard,
  .bundleCard,
  .packageCard,
  .locationMode {
    text-align: left;
    background: linear-gradient(180deg, #101312, #090a0a);
    color: #f5f5f5;
    border: 1px solid #252a28;
    border-radius: 10px;
    padding: 18px;
    display: grid;
    gap: 8px;
    cursor: pointer;
    min-height: 124px;
    position: relative;
    overflow: hidden;
    transition: border-color .16s ease, background .16s ease, transform .16s ease, box-shadow .16s ease;
  }

  .choiceCard::after,
  .bundleCard::after,
  .packageCard::after,
  .locationMode::after {
    content: "";
    position: absolute;
    inset: auto 14px 12px auto;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #2e3431;
    transition: background .16s ease, box-shadow .16s ease;
  }

  .choiceCard strong,
  .bundleCard strong,
  .packageCard strong,
  .locationMode strong {
    line-height: 1.25;
  }

  .choiceCard span,
  .bundleCard span,
  .bundleCard small,
  .packageCard span,
  .packageCard small,
  .locationMode span {
    line-height: 1.45;
  }

  .choiceCard:hover,
  .bundleCard:hover,
  .packageCard:hover,
  .locationMode:hover,
  .pill:hover,
  .checkItem:hover {
    transform: translateY(-2px);
    border-color: #3b3f3d;
    background: #121414;
    box-shadow: 0 12px 26px rgba(0, 0, 0, .22);
  }

  .choiceCard.active,
  .bundleCard.active,
  .packageCard.active,
  .locationMode.active,
  .pill.active,
  .checkItem.active {
    border-color: #f5a623;
    background: linear-gradient(180deg, rgba(245, 166, 35, .16), rgba(245, 166, 35, .07));
    box-shadow: inset 0 0 0 1px rgba(245, 166, 35, .18);
  }

  .choiceCard.active::after,
  .bundleCard.active::after,
  .packageCard.active::after,
  .locationMode.active::after {
    background: #f5a623;
    box-shadow: 0 0 18px rgba(245, 166, 35, .42);
  }

  .pillGrid,
  .checkGrid {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .checkGrid {
    display: grid;
    grid-template-columns: minmax(0, 720px);
    counter-reset: campaign-action;
  }

  .checkGrid .checkItem {
    counter-increment: campaign-action;
    display: grid;
    grid-template-columns: 30px 18px minmax(0, 1fr);
    width: 100%;
    min-height: 58px;
    box-sizing: border-box;
  }

  .checkGrid .checkItem::before {
    content: counter(campaign-action);
    display: grid;
    place-items: center;
    width: 28px;
    height: 28px;
    border-radius: 9px;
    background: #191d1b;
    color: #f5a623;
    font-size: 12px;
    font-weight: 900;
  }

  .checkGrid .checkItem.active::before {
    background: #f5a623;
    color: #151006;
  }

  .pill {
    border: 1px solid #222625;
    background: #0d100f;
    color: #f5f5f5;
    border-radius: 999px;
    padding: 11px 15px;
    font-weight: 850;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
  }

  .sectionDivider {
    height: 1px;
    background: #1b1f1d;
    margin: 4px 0;
  }

  .appInstructionPanel {
    display: grid;
    gap: 12px;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: #0a0c0b;
    padding: 16px;
  }

  .appInstructionTop {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .appInstructionTop > div {
    display: grid;
    gap: 5px;
  }

  .appInstructionTop h3 {
    margin: 0;
    color: #f7f7f7;
    font-size: 22px;
    line-height: 1.15;
  }

  .appInstructionTop > span {
    flex: 0 0 auto;
    border: 1px solid rgba(245, 166, 35, .24);
    border-radius: 999px;
    background: rgba(245, 166, 35, .08);
    color: #f5a623;
    padding: 6px 9px;
    font-size: 11px;
    font-weight: 950;
  }

  .appInstructionCopy {
    margin: 0;
    max-width: 760px;
    color: #b4b8b6;
    font-size: 13px;
    line-height: 1.5;
  }

  .appInstructionEditor {
    display: grid;
    gap: 8px;
  }

  .appInstructionEditor textarea {
    width: 100%;
    min-height: 210px;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: #070808;
    color: #f7f7f7;
    line-height: 1.6;
    font-size: 14px;
    padding: 15px;
    resize: vertical;
  }

  .appInstructionEditor small {
    color: #8f9692;
    font-size: 12px;
    line-height: 1.4;
  }

  .appTestSummary {
    display: grid;
    gap: 5px;
    border: 1px solid rgba(245, 166, 35, .18);
    border-radius: 9px;
    background: rgba(245, 166, 35, .055);
    padding: 12px;
  }

  .appTestSummary span {
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .appTestSummary strong {
    color: #f5f5f5;
    font-size: 14px;
    line-height: 1.35;
  }

  .interestTargeting {
    display: grid;
    gap: 12px;
    border: 1px solid #222625;
    border-radius: 8px;
    background: #0b0c0c;
    padding: 15px;
  }

  .interestTargeting > div:first-child {
    display: grid;
    gap: 6px;
  }

  .interestTargeting span {
    color: #a8a8a8;
    line-height: 1.55;
  }

  .interestDropdown {
    border: 1px solid #252a28;
    border-radius: 10px;
    background: linear-gradient(180deg, #101211, #080909);
    box-shadow: 0 14px 34px rgba(0, 0, 0, .22);
    overflow: hidden;
  }

  .interestDropdown summary {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 16px;
    min-height: 66px;
    padding: 13px 15px;
    cursor: pointer;
    list-style: none;
    outline: none;
    transition: background .16s ease, border-color .16s ease;
  }

  .interestDropdown summary:hover {
    background: rgba(245, 166, 35, .05);
  }

  .interestDropdown summary:focus-visible {
    box-shadow: inset 0 0 0 2px rgba(245, 166, 35, .5);
  }

  .interestDropdown summary::-webkit-details-marker {
    display: none;
  }

  .interestDropdownCopy {
    min-width: 0;
    display: grid;
    gap: 4px;
  }

  .interestDropdownCopy > span {
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .06em;
    line-height: 1.2;
    text-transform: uppercase;
  }

  .interestDropdownCopy strong {
    max-width: 100%;
    color: #f5f5f5;
    font-size: 14px;
    font-weight: 950;
    line-height: 1.35;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .interestDropdownMeta {
    display: inline-flex;
    align-items: center;
    gap: 10px;
    min-width: max-content;
  }

  .interestDropdownMeta > span {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 28px;
    border: 1px solid rgba(245, 166, 35, .24);
    border-radius: 999px;
    background: rgba(245, 166, 35, .1);
    color: #f5a623;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 950;
    line-height: 1;
  }

  .interestDropdownMeta i {
    width: 9px;
    height: 9px;
    border-right: 2px solid #f5a623;
    border-bottom: 2px solid #f5a623;
    transform: rotate(45deg) translateY(-2px);
    transition: transform .16s ease;
  }

  .interestDropdown[open] .interestDropdownMeta i {
    transform: rotate(225deg) translateY(-1px);
  }

  .interestDropdownPanel {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 9px;
    border-top: 1px solid #202423;
    background: #080909;
    padding: 12px;
  }

  .dropdownCheck {
    display: flex;
    align-items: center;
    gap: 10px;
    min-height: 44px;
    border: 1px solid #202423;
    border-radius: 8px;
    background: #0d100f;
    padding: 10px 11px;
    color: #f5f5f5;
    font-size: 13px;
    font-weight: 850;
    cursor: pointer;
    transition: border-color .16s ease, background .16s ease, box-shadow .16s ease, transform .16s ease;
  }

  .dropdownCheck:hover {
    transform: translateY(-1px);
    border-color: #363d3a;
    background: #111514;
  }

  .dropdownCheck input {
    width: 16px;
    height: 16px;
    accent-color: #f5a623;
  }

  .dropdownCheck span {
    color: inherit;
    line-height: 1.35;
  }

  .dropdownCheck.active {
    border-color: #f5a623;
    background: linear-gradient(180deg, rgba(245, 166, 35, .16), rgba(245, 166, 35, .08));
    box-shadow: inset 0 0 0 1px rgba(245, 166, 35, .18);
  }

  .interestGrid .checkItem {
    min-height: 42px;
  }

  .inlineSectionTitle {
    margin: 0;
    color: #f5a623;
    font-size: 12px;
    font-weight: 950;
    text-transform: uppercase;
  }

  .bundleCard {
    cursor: default;
  }

  .bundleSelectButton {
    border: 0;
    padding: 0;
    background: transparent;
    color: inherit;
    text-align: left;
    display: grid;
    gap: 8px;
    cursor: pointer;
    font: inherit;
  }

  .bundlePricingList {
    display: grid;
    gap: 10px;
    margin-top: 8px;
    padding-top: 14px;
    border-top: 1px solid #252a28;
  }

  .pricingCheck {
    display: grid;
    grid-template-columns: 18px minmax(0, 1fr) auto;
    gap: 10px;
    align-items: center;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: #0d100f;
    padding: 12px;
    cursor: pointer;
    transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
  }

  .pricingCheck:hover {
    transform: translateY(-1px);
    border-color: rgba(245, 166, 35, .34);
    box-shadow: 0 10px 22px rgba(0, 0, 0, .2);
  }

  .pricingCheck.active {
    border-color: #f5a623;
    background: rgba(245, 166, 35, .1);
  }

  .pricingCheck input {
    width: 16px;
    height: 16px;
    accent-color: #f5a623;
  }

  .pricingCheck span {
    display: grid;
    gap: 3px;
    min-width: 0;
  }

  .pricingCheck small {
    color: #a8a8a8;
    font-size: 12px;
    overflow-wrap: anywhere;
  }

  .pricingCheck em {
    color: #f5a623;
    font-style: normal;
    font-weight: 900;
    white-space: nowrap;
  }

  .emptyPricing {
    margin: 0;
    color: #a8a8a8;
    border: 1px solid #222625;
    border-radius: 8px;
    padding: 16px;
    background: #0c0d0d;
  }

  .fieldBlock {
    display: grid;
    gap: 8px;
    color: #e8e8e8;
    font-weight: 850;
  }

  .fieldBlock input,
  .fieldBlock textarea {
    border-color: #252a28;
    background: #080909;
  }

  .fieldBlock input::placeholder,
  .fieldBlock textarea::placeholder {
    color: rgba(116, 124, 120, .68);
    font-size: 12px;
    font-weight: 400;
    opacity: 1;
  }

  .goalChecklist {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .goalOption {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    min-height: 86px;
    padding: 14px;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: linear-gradient(180deg, #101312, #090a0a);
    color: #d9d9d9;
    cursor: pointer;
    font-weight: 850;
    transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
  }

  .goalOption:hover {
    transform: translateY(-1px);
    border-color: #3b3f3d;
    background: #111514;
    box-shadow: 0 12px 26px rgba(0, 0, 0, .2);
  }

  .goalOption.active {
    background: linear-gradient(180deg, rgba(245, 166, 35, .16), rgba(245, 166, 35, .07));
    border-color: #f5a623;
    color: #fff;
    box-shadow: inset 0 0 0 1px rgba(245, 166, 35, .18);
  }

  .goalOption input {
    width: 16px;
    height: 16px;
    accent-color: #f5a623;
  }

  .goalOption span {
    display: grid;
    gap: 4px;
    overflow-wrap: anywhere;
  }

  .goalOption strong {
    line-height: 1.25;
  }

  .goalOption small {
    color: #a8a8a8;
    line-height: 1.45;
    font-weight: 700;
  }

  .fieldBlock small {
    color: #8f8f8f;
    font-size: 12px;
    font-weight: 700;
  }

  .fieldBlock.compact {
    max-width: 320px;
  }

  .locationTargeting {
    display: grid;
    gap: 14px;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: linear-gradient(180deg, #101211, #080909);
    padding: 15px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, .2);
  }

  .locationTargetingHead {
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: 16px;
    padding-bottom: 13px;
    border-bottom: 1px solid #202423;
  }

  .locationTargetingHead > div {
    display: grid;
    gap: 6px;
    min-width: 0;
  }

  .locationTargetingHead span {
    color: #a8a8a8;
    line-height: 1.5;
    overflow-wrap: anywhere;
  }

  .locationTargetingHead > strong {
    flex: 0 0 auto;
    display: inline-flex;
    align-items: center;
    min-height: 28px;
    border: 1px solid rgba(245, 166, 35, .24);
    border-radius: 999px;
    background: linear-gradient(180deg, rgba(245, 166, 35, .15), rgba(245, 166, 35, .07));
    box-shadow: inset 0 0 0 1px rgba(245, 166, 35, .16);
    color: #f5a623;
    padding: 0 10px;
    font-size: 12px;
    font-weight: 950;
    white-space: nowrap;
  }

  .locationModeGrid {
    gap: 10px;
  }

  .locationMode {
    grid-template-columns: auto minmax(0, 1fr);
    align-items: start;
    min-height: 112px;
    border-color: #252a28;
    background: #0d100f;
    padding: 14px;
  }

  .locationModeIcon {
    grid-row: span 2;
    width: 38px;
    height: 38px;
    display: inline-grid;
    place-items: center;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: #080909;
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .03em;
  }

  .locationMode.active .locationModeIcon {
    border-color: rgba(245, 166, 35, .42);
    background: #f5a623;
    color: #080909;
  }

  .locationMode.active {
    background: linear-gradient(180deg, rgba(245, 166, 35, .16), rgba(245, 166, 35, .08));
  }

  .locationField {
    border: 1px solid #202423;
    border-radius: 10px;
    background: #0b0d0c;
    padding: 12px;
  }

  .locationField > span,
  .locationField > label,
  .locationField > span:first-child {
    color: #f5f5f5;
    font-size: 12px;
    font-weight: 950;
    letter-spacing: .03em;
    text-transform: uppercase;
  }

  .locationField input {
    border-color: #252a28;
    background: #070808;
  }

  .locationField input:focus {
    border-color: rgba(245, 166, 35, .62);
    box-shadow: 0 0 0 3px rgba(245, 166, 35, .12);
  }

  .locationField small {
    margin-left: 4px;
    color: #8f8f8f;
    font-size: 11px;
    font-weight: 800;
    letter-spacing: 0;
    text-transform: none;
  }

  .fieldHelp {
    display: block;
    margin-top: 7px;
    color: #9d9d9d;
    font-size: 13px;
    line-height: 1.45;
  }

  .fieldNotice {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    border: 1px solid #222625;
    border-radius: 10px;
    background: #0b0c0c;
    padding: 13px;
  }

  .fieldNotice div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .fieldNotice strong {
    color: #f5f5f5;
  }

  .fieldNotice span {
    color: #a8a8a8;
    overflow-wrap: anywhere;
  }

  .fieldNotice button {
    border: 1px solid rgba(245, 166, 35, .34);
    border-radius: 8px;
    background: rgba(245, 166, 35, .1);
    color: #f5a623;
    padding: 9px 12px;
    font-weight: 900;
    cursor: pointer;
  }

  .locationGrid {
    display: grid;
    gap: 12px;
    margin-top: 0;
    border-top: 1px solid #202423;
    padding-top: 14px;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .stateField {
    position: relative;
  }

  .stateSuggestions {
    position: absolute;
    z-index: 18;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    display: grid;
    gap: 5px;
    max-height: 238px;
    overflow-y: auto;
    padding: 8px;
    border: 1px solid rgba(245, 166, 35, .24);
    border-radius: 10px;
    background: #0b0d0c;
    box-shadow: 0 18px 44px rgba(0, 0, 0, .34);
  }

  .stateSuggestions button {
    width: 100%;
    border: 0;
    border-radius: 7px;
    padding: 10px 11px;
    background: transparent;
    color: #ededed;
    text-align: left;
    font-weight: 850;
    cursor: pointer;
  }

  .stateSuggestions button strong,
  .stateSuggestions button span,
  .stateSuggestions button small {
    display: block;
  }

  .stateSuggestions button strong {
    color: #f5f5f5;
    font-size: 13px;
  }

  .stateSuggestions button span {
    margin-top: 3px;
    color: #a8a8a8;
    font-size: 11px;
    font-weight: 800;
    text-transform: capitalize;
  }

  .stateSuggestions button small {
    margin-top: 4px;
    color: #f5a623;
    font-size: 11px;
    font-weight: 900;
  }

  .stateSuggestions button:hover,
  .stateSuggestions button[aria-selected="true"] {
    background: rgba(245, 166, 35, .14);
    color: #fff;
  }

  .locationSlot {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 10px;
    align-content: start;
    border: 1px solid #202423;
    border-radius: 10px;
    background: #090b0a;
    padding: 12px;
  }

  .locationSlotHead {
    grid-column: 1 / -1;
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: center;
    padding-bottom: 2px;
  }

  .locationSlotHead strong {
    color: #f5f5f5;
    font-size: 13px;
    font-weight: 950;
  }

  .locationSlotHead span {
    border: 1px solid rgba(245, 166, 35, .24);
    border-radius: 999px;
    background: rgba(245, 166, 35, .1);
    color: #f5a623;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 950;
  }

  .removeLocationButton,
  .addLocationButton {
    border: 1px solid rgba(245, 166, 35, .34);
    border-radius: 8px;
    background: rgba(245, 166, 35, .08);
    color: #f5a623;
    font: inherit;
    font-size: 12px;
    font-weight: 950;
    cursor: pointer;
  }

  .removeLocationButton {
    padding: 7px 10px;
  }

  .addLocationButton {
    min-height: 46px;
    border-style: dashed;
    background: #0b0d0c;
  }

  .removeLocationButton:hover,
  .addLocationButton:hover {
    border-color: rgba(245, 166, 35, .62);
    background: rgba(245, 166, 35, .12);
  }

  .locationAddress {
    grid-column: 1 / -1;
  }

  .locationSearchField,
  .locationGeoCard {
    grid-column: 1 / -1;
  }

  .selectedLocationList {
    grid-column: 1 / -1;
    display: grid;
    gap: 10px;
  }

  .locationGeoCard {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 5px 12px;
    border: 1px solid rgba(26, 239, 34, .22);
    border-radius: 10px;
    background: rgba(26, 239, 34, .06);
    padding: 12px;
  }

  .locationGeoCard span {
    grid-column: 1;
    width: fit-content;
    border: 1px solid rgba(26, 239, 34, .28);
    border-radius: 999px;
    color: #1aef22;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 950;
    text-transform: capitalize;
  }

  .locationGeoCard strong {
    grid-column: 1;
    color: #f5f5f5;
    overflow-wrap: anywhere;
  }

  .locationGeoCard small {
    display: none;
    grid-column: 1;
    color: #a8a8a8;
    line-height: 1.45;
  }

  .locationGeoCard .removeLocationButton {
    grid-column: 2;
    grid-row: 1 / span 3;
    align-self: center;
  }

  .locationSummary {
    display: grid;
    gap: 5px;
    border: 1px solid rgba(245, 166, 35, .26);
    border-radius: 8px;
    background: rgba(245, 166, 35, .08);
    padding: 15px;
  }

  .locationSummary span {
    color: #a8a8a8;
    font-size: 12px;
    font-weight: 850;
    text-transform: uppercase;
  }

  .locationSummary strong {
    color: #f5f5f5;
    line-height: 1.45;
  }

  .interestSummary {
    border-color: rgba(255, 255, 255, .14);
    background: rgba(255, 255, 255, .035);
  }

  input,
  textarea {
    width: 100%;
    border: 1px solid #252a28;
    border-radius: 10px;
    background: #090a0a;
    color: #f7f7f7;
    padding: 13px 14px;
    font: inherit;
    outline: none;
  }

  input:focus,
  textarea:focus {
    border-color: rgba(245, 166, 35, .75);
    box-shadow: 0 0 0 3px rgba(245, 166, 35, .12);
  }

  textarea {
    min-height: 112px;
    resize: vertical;
  }

  .checkItem {
    display: inline-flex;
    align-items: center;
    gap: 9px;
    border: 1px solid #252a28;
    background: #0d100f;
    border-radius: 10px;
    padding: 12px 14px;
    cursor: pointer;
    font-weight: 800;
    transition: transform .16s ease, border-color .16s ease, background .16s ease, box-shadow .16s ease;
  }

  .checkItem input {
    width: 16px;
    height: 16px;
    accent-color: #f5a623;
  }

  .assetPanel {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 260px;
    gap: 14px;
    align-items: stretch;
    background: linear-gradient(180deg, #101312, #090a0a);
    border: 1px solid #252a28;
    border-radius: 10px;
    padding: 17px;
    box-shadow: 0 14px 34px rgba(0, 0, 0, .2);
  }

  .assetPanel h3 {
    margin: 4px 0 8px;
    font-size: 22px;
  }

  .assetPanel span {
    display: block;
    color: #a8a8a8;
    line-height: 1.6;
  }

  .uploadBox {
    min-height: 138px;
    border: 1px dashed rgba(245, 166, 35, .36);
    border-radius: 10px;
    background: rgba(245, 166, 35, .06);
    display: grid;
    place-items: center;
    align-content: center;
    gap: 6px;
    padding: 16px;
    cursor: pointer;
    text-align: center;
    transition: border-color .16s ease, background .16s ease, transform .16s ease;
  }

  .uploadBox:hover {
    transform: translateY(-1px);
    border-color: rgba(245, 166, 35, .62);
    background: rgba(245, 166, 35, .1);
  }

  .uploadBox input {
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  }

  .uploadBox strong {
    color: #f5f5f5;
    max-width: 100%;
    overflow-wrap: anywhere;
  }

  .uploadBox small {
    color: #a8a8a8;
    font-weight: 700;
  }

  .linkOnlyPanel {
    grid-template-columns: minmax(0, 1fr) 180px;
  }

  .linkBadge {
    border: 1px solid #2d312f;
    border-radius: 10px;
    background: #111413;
    display: grid;
    place-items: center;
    align-content: center;
    gap: 6px;
    padding: 16px;
    text-align: center;
  }

  .linkBadge strong {
    color: #f5a623;
    font-size: 20px;
  }

  .linkBadge small {
    color: #a8a8a8;
    font-weight: 800;
  }

  .campaignPreview,
  .previewSection,
  .readinessPanel {
    background: linear-gradient(180deg, #101312, #090a0a);
    border: 1px solid #252a28;
    border-radius: 10px;
    padding: 18px;
  }

  .campaignPreview {
    display: grid;
    gap: 14px;
    width: min(100%, 920px);
    margin: 0 auto;
    padding: 0;
    background: transparent;
    border: 0;
  }

  .previewTopbar {
    display: grid;
    grid-template-columns: 90px minmax(0, 1fr) 90px;
    align-items: center;
    color: #a8a8a8;
    font-weight: 900;
  }

  .previewTopbar strong {
    color: #fff;
    font-size: 20px;
    text-align: center;
  }

  .previewTextButton {
    border: 0;
    background: transparent;
    color: #f5a623;
    font: inherit;
    font-weight: 950;
    cursor: pointer;
    padding: 8px 0;
    text-align: right;
  }

  .previewTextButton.muted {
    color: #a8a8a8;
    text-align: left;
  }

  .readyItem {
    display: flex;
    justify-content: space-between;
    gap: 14px;
    padding: 10px 0;
    border-bottom: 1px solid #1b1f1d;
  }

  .previewSection h3,
  .previewHeroCard h3 {
    margin: 0 0 12px;
  }

  .previewHeroCard {
    display: grid;
    grid-template-columns: minmax(0, 1.1fr) 260px;
    gap: 16px;
    align-items: stretch;
    background: #0b0c0c;
    border: 1px solid #222625;
    border-radius: 8px;
    padding: 18px;
  }

  .previewHeroCopy {
    display: grid;
    align-content: start;
    gap: 12px;
  }

  .previewStatus {
    width: fit-content;
    border-radius: 999px;
    background: rgba(245, 166, 35, .12);
    color: #f5a623;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 900;
  }

  .previewStatus.ready {
    background: rgba(26, 239, 34, .12);
    color: #1aef22;
  }

  .previewHeroCard h3 {
    color: #fff;
    font-size: clamp(24px, 4vw, 36px);
    line-height: 1.08;
  }

  .previewHeroCard p {
    max-width: 680px;
    color: #b8b8b8;
    line-height: 1.65;
  }

  .previewGoalLine {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .previewCaptionBox {
    display: grid;
    gap: 7px;
    border: 1px solid rgba(245,166,35,.25);
    border-radius: 12px;
    background: rgba(245,166,35,.08);
    padding: 12px;
    margin-top: 12px;
  }

  .previewCaptionBox strong {
    color: #F5A623;
    font-size: 11px;
    text-transform: uppercase;
    letter-spacing: .04em;
  }

  .previewCaptionBox span {
    color: #f5f5f5;
    font-size: 13px;
    line-height: 1.55;
    white-space: pre-wrap;
  }

  .previewGoalLine strong,
  .previewSectionHead span,
  .previewPlatformCard small,
  .contributorMissionCard span,
  .contributorMeta small,
  .previewSplit span,
  .previewAudienceGrid span {
    color: #a8a8a8;
  }

  .previewGoalLine strong,
  .previewSectionHead span,
  .previewPillButton {
    border-radius: 999px;
    background: rgba(245, 166, 35, .12);
    color: #f5a623;
    padding: 5px 9px;
    font-size: 12px;
  }

  .previewPillButton {
    border: 0;
    font-weight: 950;
    cursor: pointer;
    white-space: nowrap;
  }

  .previewAssetCard {
    min-height: 190px;
    display: grid;
    align-content: end;
    gap: 8px;
    border: 1px solid rgba(245, 166, 35, .3);
    border-radius: 8px;
    background:
      linear-gradient(160deg, rgba(245, 166, 35, .22), transparent 54%),
      #111313;
    padding: 16px;
    overflow: hidden;
  }

  .previewAssetCard span {
    width: fit-content;
    color: #050505;
    background: #f5a623;
    border-radius: 999px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 950;
  }

  .previewAssetCard img {
    width: 100%;
    max-height: 220px;
    object-fit: cover;
    border-radius: 8px;
    border: 1px solid #282c2a;
  }

  .previewAssetCard strong {
    color: #fff;
    overflow-wrap: anywhere;
  }

  .previewAssetCard small {
    color: #d0d0d0;
  }

  .previewAssetButton {
    width: fit-content;
    border: 1px solid rgba(245, 166, 35, .42);
    border-radius: 8px;
    background: rgba(245, 166, 35, .1);
    color: #f5a623;
    padding: 8px 10px;
    font-weight: 950;
    cursor: pointer;
  }

  .previewSectionHead {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    align-items: flex-start;
    margin-bottom: 12px;
  }

  .previewPlatformGrid,
  .previewAudienceGrid,
  .previewFooterGrid {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }

  .previewAudienceGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .previewFooterGrid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .previewPlatformCard,
  .previewAudienceGrid article,
  .contributorMissionCard {
    border: 1px solid #202322;
    border-radius: 8px;
    background: #101111;
    padding: 13px;
  }

  .previewPlatformCard {
    display: grid;
    grid-template-columns: 42px minmax(0, 1fr);
    align-items: center;
    gap: 10px;
  }

  .previewPlatformCard > span {
    grid-row: span 2;
    width: 42px;
    height: 42px;
    display: grid;
    place-items: center;
    border-radius: 50%;
    background: #f5a623;
    color: #050505;
    font-weight: 950;
  }

  .previewPlatformCard strong,
  .previewAudienceGrid strong,
  .previewSplit strong {
    color: #f5f5f5;
    overflow-wrap: anywhere;
  }

  .previewActionGrid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px 14px;
  }

  .previewActionItem {
    display: block;
    color: #d8d8d8;
    font-weight: 800;
  }

  .previewActionItem p {
    margin: 0;
    line-height: 1.45;
  }

  .previewAudienceGrid article,
  .previewSplit > div {
    display: grid;
    gap: 7px;
  }

  .previewSplit .fundingRequired {
    border: 1px solid rgba(245, 166, 35, .36);
    border-radius: 8px;
    background: rgba(245, 166, 35, .08);
    padding: 10px;
  }

  .previewSplit .fundingRequired strong,
  .previewSplit .fundingRequired span {
    color: #f5a623;
  }

  .fundingHint {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    align-items: center;
    gap: 12px;
    margin: 14px 0 0;
    border: 1px solid rgba(245, 166, 35, .32);
    border-radius: 10px;
    background:
      linear-gradient(180deg, rgba(245, 166, 35, .1), rgba(245, 166, 35, .045)),
      #0b0c0c;
    padding: 13px 14px;
  }

  .fundingHint div {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .fundingHint span {
    color: #f5a623;
    font-size: 11px;
    font-weight: 950;
    letter-spacing: .04em;
    text-transform: uppercase;
  }

  .fundingHint strong {
    color: #f5f5f5;
    font-size: 14px;
    line-height: 1.35;
  }

  .fundingHint small {
    border: 1px solid rgba(245, 166, 35, .26);
    border-radius: 999px;
    background: rgba(0, 0, 0, .18);
    color: #d5d5d5;
    padding: 7px 10px;
    font-size: 12px;
    font-weight: 850;
    white-space: nowrap;
  }

  .contributorPreviewPanel {
    background: rgba(245, 166, 35, .06);
  }

  .contributorMissionCard {
    display: grid;
    grid-template-columns: 92px minmax(0, 1fr);
    gap: 14px;
  }

  .contributorThumb {
    min-height: 92px;
    display: grid;
    place-items: center;
    border-radius: 8px;
    background:
      linear-gradient(145deg, rgba(245, 166, 35, .32), transparent),
      #090a0a;
    color: #f5a623;
  }

  .contributorMissionCard h4 {
    margin: 5px 0 11px;
    color: #fff;
    font-size: 17px;
  }

  .contributorMeta {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .contributorMeta strong {
    color: #1aef22;
  }

  .contributorMeta small {
    border-left: 1px solid #303432;
    padding-left: 10px;
  }

  .previewSplit {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }

  .previewBudgetBreakdown {
    display: grid;
    gap: 8px;
    margin-top: 14px;
    padding-top: 14px;
    border-top: 1px solid #202322;
  }

  .previewBudgetBreakdown > div {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
  }

  .previewBudgetBreakdown span {
    color: #a8a8a8;
    font-size: 12px;
    font-weight: 850;
  }

  .previewBudgetBreakdown strong {
    color: #f5f5f5;
    font-size: 13px;
    font-weight: 950;
    text-align: right;
    white-space: nowrap;
  }

  .previewDots {
    display: flex;
    justify-content: center;
    gap: 6px;
    margin-top: 13px;
  }

  .previewDots span {
    width: 7px;
    height: 7px;
    border-radius: 999px;
    background: #303432;
  }

  .previewDots span:first-child {
    width: 18px;
    background: #f5a623;
  }

  .previewActionFooter {
    display: grid;
    grid-template-columns: minmax(0, .8fr) minmax(0, 1.2fr);
    gap: 12px;
  }

  .previewActionFooter button {
    min-height: 48px;
    border-radius: 8px;
    font-weight: 950;
    cursor: pointer;
  }

  .previewDraftButton {
    border: 1px solid rgba(245, 166, 35, .38);
    background: #101111;
    color: #f5a623;
  }

  .previewLaunchButton {
    border: 0;
    background: #f5a623;
    color: #050505;
    box-shadow: 0 14px 30px rgba(245, 166, 35, .18);
  }

  .readyItem {
    align-items: center;
    justify-content: flex-start;
    color: #d8d8d8;
    font-weight: 850;
  }

  .readyItem span {
    width: 42px;
    color: #f5a623;
    font-size: 12px;
  }

  .readyItem.good span {
    color: #1aef22;
  }

  .actionsBar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    margin-top: 24px;
    border: 1px solid #202423;
    border-radius: 10px;
    background: #090a0a;
    padding: 12px;
  }


  @media (min-width: 1720px) {
    .builderLayout {
      grid-template-columns: 240px minmax(620px, 1fr);
    }
  }

  @media (max-width: 1400px) {
    .pageShell,
    .successShell,
    .loadingShell {
      padding-left: 18px;
      padding-right: 18px;
    }

    .heroBand {
      grid-template-columns: 1fr;
    }

    .walletCard {
      min-height: 0;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
    }
  }

  .errorText {
    margin: 16px 0 0;
    border: 1px solid rgba(229, 62, 62, .4);
    background: rgba(229, 62, 62, .08);
    color: #ffb8b8;
    border-radius: 10px;
    padding: 12px;
    font-weight: 800;
  }

  .errorText.compact {
    margin: 0;
  }

  .policyConfirmBox {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    margin-top: 14px;
    border: 1px solid rgba(245, 166, 35, .25);
    border-radius: 12px;
    background: rgba(245, 166, 35, .08);
    padding: 12px;
    color: #d8d8d8;
    font-size: 12px;
    line-height: 1.55;
    cursor: pointer;
  }

  .policyConfirmBox input {
    width: 17px;
    height: 17px;
    margin-top: 2px;
    accent-color: #f5a623;
  }

  .policyConfirmBox a {
    color: #f5a623;
    font-weight: 900;
    text-decoration: none;
  }

  @media (prefers-reduced-motion: reduce) {
    .heroBand > div:first-child,
    .walletCard,
    .stepRail,
    .builderPanel {
      animation: none !important;
    }

    .choiceCard,
    .bundleCard,
    .packageCard,
    .locationMode,
    .pill,
    .checkItem,
    .pricingCheck {
      transition: none !important;
    }

    .choiceCard:hover,
    .bundleCard:hover,
    .packageCard:hover,
    .locationMode:hover,
    .pill:hover,
    .checkItem:hover,
    .pricingCheck:hover {
      transform: none;
    }
  }

  @media (max-width: 1180px) {
    .pageShell,
    .successShell,
    .loadingShell {
      padding-left: 24px;
    }

    .builderLayout {
      grid-template-columns: 190px minmax(0, 1fr);
    }

  }

  @media (max-width: 820px) {
    .pageShell,
    .successShell,
    .loadingShell {
      padding: 14px 14px 104px;
    }

    .heroBand,
    .builderLayout,
    .assetPanel,
    .goalChecklist,
    .categoryGrid,
    .bundleGrid,
    .packageGrid,
    .locationModeGrid,
    .locationGrid,
    .locationSlot,
    .previewHeroCard,
    .previewPlatformGrid,
    .previewAudienceGrid,
    .previewFooterGrid,
    .previewActionGrid,
    .previewActionFooter,
    .successSummaryGrid,
    .previewGrid,
    .launchGrid {
      grid-template-columns: 1fr;
    }

    .fundingHint {
      grid-template-columns: 1fr;
    }

    .fundingHint small {
      width: fit-content;
      white-space: normal;
    }

    .previewTopbar {
      grid-template-columns: 64px minmax(0, 1fr) 64px;
    }

    .locationAddress {
      grid-column: auto;
    }

    .contributorMissionCard {
      grid-template-columns: 1fr;
    }

    .contributorThumb {
      min-height: 72px;
    }

    .heroBand {
      gap: 10px;
      margin-bottom: 10px;
    }

    .heroBand > div:first-child,
    .walletCard,
    .builderPanel,
    .stepRail {
      box-shadow: none;
    }

    .heroBand > div:first-child {
      padding: 16px;
    }

    .successPanel {
      padding: 22px 16px;
    }

    .successActions {
      display: grid;
    }

    .heroBand h1 {
      font-size: 25px;
      line-height: 1.08;
      margin-bottom: 8px;
    }

    .heroBand p:not(.eyebrow) {
      font-size: 13px;
      line-height: 1.48;
    }

    .walletCard {
      padding: 13px 14px;
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      align-items: center;
      gap: 4px 12px;
    }

    .walletCard strong {
      font-size: 22px;
      grid-row: span 2;
    }

    .walletCard small {
      grid-column: 1;
    }

    .stepRail {
      position: static;
      display: block;
      padding: 12px;
    }

    .stepRail .step {
      display: none;
    }

    .builderPanel {
      min-height: auto;
      padding: 14px;
    }

    .sectionHeader h2 {
      font-size: 22px;
    }

    .interestDropdown summary {
      grid-template-columns: 1fr;
      gap: 10px;
    }

    .interestDropdownMeta {
      justify-content: space-between;
      width: 100%;
    }

    .interestDropdownPanel {
      grid-template-columns: 1fr;
    }

    .appInstructionTop {
      align-items: flex-start;
      flex-direction: column;
    }

    .locationTargetingHead {
      display: grid;
      gap: 10px;
    }

    .locationTargetingHead > strong {
      width: max-content;
    }

    .locationMode {
      min-height: auto;
    }

    .choiceCard,
    .bundleCard,
    .packageCard {
      min-height: 0;
    }

    .actionsBar {
      position: static;
      background: #0d0d0d;
      border: 1px solid #1b1b1b;
      border-radius: 8px;
      padding: 10px;
      margin-top: 18px;
    }

    .primaryButton,
    .secondaryButton {
      flex: 1;
    }
  }
`;
