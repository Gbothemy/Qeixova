export type LegalSection = {
  heading: string;
  body: string;
};

export type LegalDocument = {
  title: string;
  updatedAt: string;
  summary: string;
  sections: LegalSection[];
};

export const legalDocuments = {
  terms: {
    title: "Terms of Service",
    updatedAt: "June 21, 2026",
    summary:
      "These terms explain the rules for using Qeixova as a contributor, business campaign owner, visitor, or account holder.",
    sections: [
      {
        heading: "1. About Qeixova",
        body:
          "Qeixova is a community-powered digital growth platform that connects businesses, creators, musicians, events, startups, and communities with contributors who complete approved missions. Missions may include content distribution, local visibility, campaign awareness, app testing, user feedback, referrals, and related growth activities.",
      },
      {
        heading: "2. Acceptance of Terms",
        body:
          "By creating an account, browsing the platform, funding a campaign, completing a mission, submitting proof, requesting withdrawal, or using any Qeixova service, you agree to these Terms of Service, the Privacy Policy, Refund Policy, campaign rules, contributor rules, and any instructions shown inside the platform. If you do not agree, do not use Qeixova.",
      },
      {
        heading: "3. Account Eligibility",
        body:
          "You must provide accurate registration information and keep your account secure. You must not create duplicate accounts, share accounts, impersonate another person or business, bypass verification, or use Qeixova if your account has been suspended or banned. Qeixova may restrict accounts that create fraud, risk, abuse, or policy violations.",
      },
      {
        heading: "4. Contributor Responsibilities",
        body:
          "Contributors must complete missions honestly, follow all campaign instructions, choose only platforms they actually used, submit clear proof, keep required content visible for the required duration, and avoid fake engagement, bots, automated actions, manipulated screenshots, reused proof, spam, harassment, or misleading activity. Rewards are only earned after approval.",
      },
      {
        heading: "5. Business and Campaign Owner Responsibilities",
        body:
          "Businesses must provide truthful campaign information, lawful campaign assets, clear instructions, accurate targeting, and sufficient budget. Campaigns must not request illegal, harmful, deceptive, abusive, fake, defamatory, political manipulation, adult, gambling, scam, spam, or prohibited platform activity. Qeixova may reject, pause, edit, or remove campaigns that create risk.",
      },
      {
        heading: "6. Campaign Matching and Targeting",
        body:
          "Qeixova may match contributors to missions using interests, location, state, selected platforms, quality score, level, trust score, completion history, campaign availability, and business targeting settings. Matching is not guaranteed, and campaign availability can change at any time.",
      },
      {
        heading: "7. Proof Review and Approval",
        body:
          "Proof may include screenshots, links, text, uploaded files, platform evidence, or other verification materials. Admins or business owners may approve or reject proof. Proof may be rejected if it is unclear, incomplete, edited, fake, duplicated, submitted from the wrong platform, missing selected platform evidence, submitted late, or does not match the mission instruction.",
      },
      {
        heading: "8. QLT Rewards and Withdrawals",
        body:
          "QLT is an internal platform reward unit. It is not cryptocurrency, legal tender, investment, security, or a public digital asset. QLT rewards are released only after mission approval. Qeixova may withhold, reverse, cancel, or adjust QLT where fraud, error, abuse, duplicate activity, invalid proof, or policy violation is suspected. Withdrawals may require minimum balance, account review, bank verification, processing time, and compliance checks.",
      },
      {
        heading: "9. Campaign Payments, Fees, and Refunds",
        body:
          "Businesses may need to fund campaigns before activation. Qeixova may charge service fees, payment processing fees, commissions, or platform fees. Refund eligibility depends on campaign status, contributor activity, approvals, disputes, payment errors, and platform policy. Refunds are handled under the Refund Policy.",
      },
      {
        heading: "10. Uploaded Content and Intellectual Property",
        body:
          "Campaign owners are responsible for the rights to any uploaded images, videos, music, captions, logos, links, or brand materials. Contributors and businesses grant Qeixova permission to store, display, review, process, and use submitted materials as needed for campaign operation, proof review, support, fraud prevention, dispute handling, analytics, and compliance.",
      },
      {
        heading: "11. Third-Party Platforms",
        body:
          "Missions may involve WhatsApp, Facebook, Instagram, TikTok, Telegram, YouTube, app stores, websites, or other third-party platforms. Qeixova does not control those platforms and is not responsible for their policies, downtime, content removal, account restrictions, algorithm changes, reach, or engagement results. Users must follow each third-party platform's rules.",
      },
      {
        heading: "12. Prohibited Activity",
        body:
          "You must not use Qeixova for fraud, scams, phishing, fake reviews, fake ratings, bot activity, harassment, hate speech, threats, defamation, impersonation, copyright infringement, illegal drugs, weapons, illegal gambling, spam campaigns, unauthorized financial schemes, account manipulation, referral abuse, proof manipulation, or any unlawful activity.",
      },
      {
        heading: "13. Suspension and Termination",
        body:
          "Qeixova may suspend, restrict, or terminate accounts, campaigns, withdrawals, proof submissions, or rewards where there is fraud risk, policy violation, security risk, legal risk, repeated rejection, misleading information, or abuse of the platform. Pending rewards may be held during review.",
      },
      {
        heading: "14. No Guaranteed Results",
        body:
          "Qeixova does not guarantee sales, customers, followers, views, viral growth, permanent engagement, conversion rates, contributor availability, platform reach, or campaign profitability. Results may vary based on targeting, content quality, audience behavior, contributor availability, and third-party platform behavior.",
      },
      {
        heading: "15. Liability and Indemnity",
        body:
          "To the fullest extent allowed by law, Qeixova is not liable for indirect losses, failed campaign outcomes, third-party platform issues, user misconduct, payment provider delays, or events outside its reasonable control. Users agree to hold Qeixova harmless from claims arising from their account, campaign content, proof submissions, platform misuse, legal violations, or third-party disputes.",
      },
      {
        heading: "16. Changes to Terms",
        body:
          "Qeixova may update these terms from time to time. Updates may be posted on the platform or communicated through reasonable notice. Continued use of Qeixova after changes become effective means you accept the updated terms.",
      },
      {
        heading: "17. Governing Law and Contact",
        body:
          "These terms are governed by the laws of the Federal Republic of Nigeria. For support, complaints, privacy requests, legal notices, or policy questions, contact Qeixova at qeixova@gmail.com.",
      },
    ],
  },
  privacy: {
    title: "Privacy Policy",
    updatedAt: "June 21, 2026",
    summary:
      "This policy explains how Qeixova collects, uses, stores, shares, and protects user, contributor, and business information.",
    sections: [
      {
        heading: "1. Information We Collect",
        body:
          "We may collect account details, names, usernames, email addresses, phone numbers, passwords or authentication data, account type, referral data, state, city, location preferences, selected interests, selected platforms, campaign activity, proof submissions, uploaded content, payment and withdrawal details, support messages, device information, IP address, browser information, usage logs, and security signals.",
      },
      {
        heading: "2. Business and Campaign Data",
        body:
          "For businesses, we may collect business name, contact information, campaign goals, target interests, selected states or locations, selected platforms, pricing options, campaign budgets, uploaded images or files, links, captions, instructions, payment references, submission history, and review decisions.",
      },
      {
        heading: "3. Proof and Verification Data",
        body:
          "Contributors may submit screenshots, links, text, profile references, platform evidence, uploaded files, and other proof. Qeixova uses this data to verify completion, prevent fraud, resolve disputes, approve or reject rewards, report campaign activity, and maintain platform trust.",
      },
      {
        heading: "4. How We Use Information",
        body:
          "We use information to create accounts, authenticate users, match contributors with campaigns, operate campaign targeting, process proof review, calculate QLT, process withdrawals, handle payments and refunds, provide support, send notifications, prevent fraud, improve the platform, enforce policies, and comply with legal obligations.",
      },
      {
        heading: "5. Location and Interest Matching",
        body:
          "Qeixova may use selected state, city, address, service area, contributor location, interests, and platform availability to match contributors with relevant missions. Users must not provide false location or interest information to manipulate mission access or rewards.",
      },
      {
        heading: "6. Sharing Information",
        body:
          "We do not sell personal information. We may share necessary information with campaign owners, contributors, payment processors, banks, hosting providers, email providers, analytics tools, security providers, support tools, legal authorities, or service providers that help operate Qeixova. Campaign owners may see proof and selected platform data needed for review.",
      },
      {
        heading: "7. Cookies and Technical Data",
        body:
          "Qeixova may use cookies, session storage, logs, and similar technologies to keep users signed in, secure accounts, remember preferences, detect abuse, improve performance, and understand usage. Some features may not work properly if cookies are disabled.",
      },
      {
        heading: "8. Data Retention",
        body:
          "We keep information for as long as needed to operate accounts, campaigns, rewards, withdrawals, fraud prevention, audit, legal compliance, dispute resolution, support, and security. Some records may be retained after account closure where required for legitimate business, safety, legal, or compliance reasons.",
      },
      {
        heading: "9. Security",
        body:
          "We use reasonable technical and organizational measures to protect information, including access controls, authentication, secure hosting, monitoring, and review processes. No online platform can guarantee absolute security, so users must keep login details private and report suspicious activity quickly.",
      },
      {
        heading: "10. User Rights",
        body:
          "Depending on applicable law, users may request access, correction, deletion, restriction, objection, portability, or withdrawal of consent. Requests can be sent to qeixova@gmail.com. We may need to verify identity before processing requests, and some records may be retained where legally or operationally required.",
      },
      {
        heading: "11. Children",
        body:
          "Qeixova is not intended for children below the age required by applicable law to use online services without parent or guardian consent. If we discover unsupported child data, we may restrict the account or delete the information.",
      },
      {
        heading: "12. Third-Party Platforms",
        body:
          "Campaigns may require users to use third-party platforms. Those platforms have their own privacy policies and terms. Qeixova is not responsible for their data practices, security, content decisions, account restrictions, or policy changes.",
      },
      {
        heading: "13. Updates and Contact",
        body:
          "We may update this Privacy Policy from time to time. Continued use of Qeixova after updates means you accept the updated policy. For privacy questions, requests, or complaints, contact qeixova@gmail.com.",
      },
    ],
  },
  refund: {
    title: "Refund Policy",
    updatedAt: "June 21, 2026",
    summary:
      "This policy explains when campaign owners may receive refunds or credits, and how contributor reward and withdrawal disputes are handled.",
    sections: [
      {
        heading: "1. Campaign Funding",
        body:
          "Businesses may fund campaigns before activation. Campaign funds may be used for contributor rewards, platform fees, payment processing, campaign review, verification, and operational costs depending on campaign status.",
      },
      {
        heading: "2. Eligible Refunds",
        body:
          "A campaign owner may be eligible for a full or partial refund where a payment error occurred, a campaign was not activated, contributors were not assigned, no mission activity started, Qeixova cancelled the campaign before execution, or duplicate payment was verified.",
      },
      {
        heading: "3. Non-Refundable Cases",
        body:
          "Refunds may be unavailable or reduced where contributors have already completed missions, rewards were approved, proof has entered review, campaign resources were used, the campaign owner provided incorrect information, the campaign violated policy, or a third-party payment provider has already charged non-refundable fees.",
      },
      {
        heading: "4. Campaign Credits",
        body:
          "Qeixova may issue campaign credits instead of cash refunds where appropriate. Credits may be used for future campaigns and may be subject to review, expiry, or platform rules.",
      },
      {
        heading: "5. Contributor Reward Disputes",
        body:
          "Contributors do not earn rewards until proof is approved. If proof is rejected, QLT may not be credited. Contributors may contact support where they believe a rejection or reward calculation was incorrect, but Qeixova may rely on available proof, platform records, and admin review.",
      },
      {
        heading: "6. Withdrawal Issues",
        body:
          "Withdrawals may take time depending on bank, payment provider, review, and compliance checks. If a withdrawal is delayed or fails, users should contact support with the transaction reference. Qeixova may retry, reverse, or investigate the withdrawal.",
      },
      {
        heading: "7. How to Request a Refund",
        body:
          "To request a refund or campaign credit, contact qeixova@gmail.com with your account email, campaign name, payment reference, amount, date, and reason. We may request additional information before making a decision.",
      },
      {
        heading: "8. Processing Time",
        body:
          "Refund and withdrawal dispute processing times may depend on internal review, payment processors, banks, wallets, and required verification. Approved refunds may take several business days to reflect.",
      },
    ],
  },
  prohibited: {
    title: "Prohibited Campaign Policy",
    updatedAt: "June 21, 2026",
    summary:
      "This policy explains the campaigns, activities, content, products, services, instructions, and behavior that are not allowed on Qeixova.",
    sections: [
      {
        heading: "1. Purpose of This Policy",
        body:
          "Qeixova is built for real human participation, structured promotion, awareness, feedback, testing, referrals, and digital growth. This policy protects contributors, campaign owners, users, the public, platform trust, legal compliance, brand safety, payment integrity, and community safety.",
      },
      {
        heading: "2. General Rule",
        body:
          "A campaign is prohibited if it is illegal, unsafe, deceptive, exploitative, misleading, harmful, abusive, fraudulent, discriminatory, or likely to violate Qeixova policies, third-party platform rules, or applicable law. Qeixova may reject, pause, remove, restrict, investigate, or report unsafe or suspicious campaigns.",
      },
      {
        heading: "3. Fraud, Scams, and Deceptive Campaigns",
        body:
          "Campaigns involving scams or deception are not allowed. This includes fake investments, Ponzi schemes, pyramid schemes, fake loan offers, fake jobs, fake giveaways, fake scholarships, phishing links, impersonation scams, advance-fee fraud, fake product claims, fake charity campaigns, or campaigns designed to collect money or personal information dishonestly.",
      },
      {
        heading: "4. Fake Engagement and Platform Manipulation",
        body:
          "Qeixova is not a fake engagement platform. Campaign owners must not request fake reviews, fake ratings, fake testimonials, fake app store reviews, fake Google reviews, fake comments, fake likes, fake followers, fake views, fake voting, bot activity, engagement farms, mass reporting, fake accounts, or any dishonest algorithm manipulation.",
      },
      {
        heading: "5. Spam and Forced Mass Messaging",
        body:
          "Campaigns must not encourage spam. Contributors must not be asked to send unsolicited bulk messages, spam WhatsApp or Telegram groups, flood comment sections, spam email or SMS contacts, use scraped phone numbers, harass people with repeated promotions, or advertise in places where they do not have permission.",
      },
      {
        heading: "6. Harassment, Bullying, Threats, and Abuse",
        body:
          "Campaigns that ask contributors to attack, insult, threaten, shame, mock, abuse, spread rumors, cyberbully, review-bomb, mass-report without valid safety reason, dox, expose private information, or pressure a person are prohibited.",
      },
      {
        heading: "7. Hate Speech and Discrimination",
        body:
          "Campaigns must not promote hate, discrimination, violence, ridicule, exclusion, or harmful stereotypes based on ethnicity, tribe, race, nationality, religion, disability, gender, age, sexual orientation, health status, political identity, social class, language, region, or any protected or vulnerable group.",
      },
      {
        heading: "8. Violence, Weapons, and Physical Harm",
        body:
          "Campaigns promoting threats, fights, attacks, illegal weapons, violent groups, dangerous challenges, self-harm, unsafe stunts, revenge attacks, mob action, vigilantism, injury, death, or instructions for harm are prohibited.",
      },
      {
        heading: "9. Adult, Sexual, or Exploitative Content",
        body:
          "Campaigns involving pornography, nudity, sexual services, escort services, sexual exploitation, revenge porn, non-consensual intimate images, sexual content involving minors, adult live-streaming, dating scams, or requests for sexual messages or images are prohibited.",
      },
      {
        heading: "10. Illegal Products and Services",
        body:
          "Campaigns promoting illegal drugs, unauthorized controlled substances, counterfeit products, stolen goods, fake documents, fake IDs, hacking services, stolen accounts, illegal streaming, pirated software, pirated media, unauthorized betting, illegal money transfers, unauthorized financial services, or any banned product or service are prohibited.",
      },
      {
        heading: "11. Financial, Investment, and Money-Related Campaigns",
        body:
          "Finance-related campaigns may require extra review. Prohibited finance campaigns include Ponzi schemes, pyramid schemes, unlicensed investments, guaranteed profit claims, double-your-money claims, fake crypto schemes, fake forex groups, illegal lending, false income claims, betting prediction scams, hidden financial risks, and fake testimonials about earnings.",
      },
      {
        heading: "12. Health, Medical, and Wellness Campaigns",
        body:
          "Health-related campaigns may require extra review. Campaigns must not promote false cure claims, miracle healing, dangerous supplements, unapproved medicine, fake medical products, unlicensed medical advice, fake before-and-after claims, or instructions that discourage professional medical care.",
      },
      {
        heading: "13. Political, Election, and Civic Campaigns",
        body:
          "Political or election-related campaigns may be restricted or prohibited. Qeixova does not allow voter suppression, election misinformation, fake political news, impersonation of candidates or government bodies, harassment of opponents, paid political deception, ethnic or religious political hate, or illegal political activity.",
      },
      {
        heading: "14. Religious and Faith-Based Campaigns",
        body:
          "Faith-based campaigns may be allowed only when respectful, lawful, and non-exploitative. Religious hate speech, attacks on other religions, fake miracle claims, fear-based manipulation, financial exploitation, violence, discrimination, or religious scams are prohibited.",
      },
      {
        heading: "15. Gambling, Betting, and Games of Chance",
        body:
          "Gambling, betting, lottery, raffle, and games-of-chance campaigns may be prohibited or strictly restricted. Qeixova may reject illegal betting, unlicensed gambling, betting prediction scams, guaranteed winning claims, gambling targeted at minors, irresponsible gambling, fake raffles, or misleading betting testimonials.",
      },
      {
        heading: "16. Age-Restricted Products",
        body:
          "Campaigns involving alcohol, tobacco, cigarettes, vapes, nicotine, shisha, cannabis-related products, or other age-restricted products may be rejected where age verification, licensing, or compliance cannot be confirmed. Such campaigns must not target minors or encourage harmful consumption.",
      },
      {
        heading: "17. Minors and Child Safety",
        body:
          "Campaigns must not exploit, target, endanger, or manipulate minors. Qeixova prohibits sexual content involving minors, dangerous challenges targeting minors, requests for minors to share private information, age-restricted product promotion to minors, use of children's images without permission, and unsafe contact with strangers.",
      },
      {
        heading: "18. Privacy Violations and Data Misuse",
        body:
          "Campaigns must not ask contributors to collect private phone numbers, scrape emails, share private chats, expose addresses, reveal financial data, share passwords, post private images without consent, track people without consent, harvest data from private groups, or submit another person's personal data without permission.",
      },
      {
        heading: "19. Intellectual Property Violations",
        body:
          "Campaigns must not promote copyright infringement, trademark misuse, piracy, counterfeit products, fake brand pages, unauthorized streaming links, cracked software, unauthorized logo use, reposting content without rights, selling copied digital products, or impersonating a brand or creator.",
      },
      {
        heading: "20. Misleading Business, Product, or Service Claims",
        body:
          "Campaign owners must not make false or misleading claims, including fake discounts, fake scarcity, fake awards, fake partnerships, fake certifications, fake product results, hidden fees, misleading delivery promises, misleading return guarantees, or claims that cannot be supported with evidence.",
      },
      {
        heading: "21. Employment, Recruitment, and Opportunity Campaigns",
        body:
          "Jobs, internships, scholarships, grants, training, and opportunity campaigns must be truthful and transparent. Fake jobs, fake scholarships, pay-before-you-work scams, hidden recruitment fees, pyramid recruitment, misleading salary claims, fake remote work offers, and unknown-purpose CV collection are prohibited.",
      },
      {
        heading: "22. Unsafe Physical Activity",
        body:
          "Campaigns must not require dangerous stunts, unsafe public challenges, physical confrontations, trespassing, blocking roads, entering restricted areas, unsafe travel, unsafe meetings with strangers, public disorder, or activities that expose contributors to harm.",
      },
      {
        heading: "23. Malware, Hacking, and Cyber Abuse",
        body:
          "Campaigns involving malware, phishing pages, fake login pages, password collection, credential harvesting, account stealing, unauthorized scraping, DDoS activity, botnets, spyware, tracking without consent, or bypassing security systems are prohibited.",
      },
      {
        heading: "24. Misinformation and Harmful False Claims",
        body:
          "Campaigns spreading harmful false claims about public safety, health, elections, finance, emergencies, legal rights, government programs, religious or ethnic groups, public figures, business competitors, disasters, crises, or criminal allegations without proof are prohibited.",
      },
      {
        heading: "25. Competitor Attacks and Defamation",
        body:
          "Qeixova must not be used to attack competitors unfairly. False claims, fake negative reviews, coordinated mass-reporting, rumors, defamation, impersonation, harassment of customers, and dishonest reputation attacks are prohibited. Fair comparison must be truthful, respectful, and evidence-based.",
      },
      {
        heading: "26. Campaigns That Cannot Be Verified",
        body:
          "Qeixova may reject campaigns that cannot be verified fairly, have unclear proof requirements, cannot be measured, depend on unavailable third-party data, expose private information, require private actions that cannot be confirmed, or have no reasonable approval standard.",
      },
      {
        heading: "27. Campaigns That Exploit Contributors",
        body:
          "Campaign owners must not ask for unpaid extra work, hide important requirements, change requirements after contributors start, move work outside Qeixova without payment protection, require contributors to pay fees, request personal favors, demand excessive time for low reward, or use confusing instructions to reject valid work.",
      },
      {
        heading: "28. Bypassing Qeixova Systems",
        body:
          "Users must not privately negotiate payment outside Qeixova, take contributors off-platform to avoid fees, ask for proof outside approved channels, hide campaign activity from Qeixova, create fake records, manipulate campaign status, avoid commission, abuse referrals, or use Qeixova to recruit for another task platform without approval.",
      },
      {
        heading: "29. Restricted Campaigns Requiring Extra Review",
        body:
          "Finance education, health and wellness, civic education, religious events, real estate, job opportunities, training programs, educational offers, fundraising, charity, giveaways, scholarships, app store reviews, age-restricted products, and claims involving income or transformation may require extra review, documents, disclaimers, or safer wording.",
      },
      {
        heading: "30. Qeixova Review Rights",
        body:
          "Qeixova may approve, reject, pause, remove, request edits, limit reach, restrict category, require proof, require campaign owner verification, cancel assignments, cancel rewards connected to prohibited activity, suspend accounts, or report illegal activity where necessary.",
      },
      {
        heading: "31. Refunds for Prohibited Campaigns",
        body:
          "Refund eligibility for prohibited campaigns is handled under the Refund Policy. A campaign owner may not receive a full refund if the campaign violated policy, used misleading information, had already been reviewed or processed, had valid contributor work completed, involved fraud, or caused payment processing or administrative costs.",
      },
      {
        heading: "32. Reporting, Responsibility, and Appeals",
        body:
          "Contributors should report suspicious, illegal, unsafe, deceptive, or prohibited campaigns. Campaign owners are responsible for ensuring campaigns are lawful, truthful, safe, properly licensed, non-spammy, non-harassing, and compliant. Rejected campaign owners may contact support with campaign details, corrected materials, and supporting evidence for review.",
      },
      {
        heading: "33. Final Agreement",
        body:
          "By using Qeixova, users confirm they will not create, fund, accept, promote, or support prohibited campaigns. Prohibited activity may lead to campaign rejection, refund denial, reward cancellation, account restriction, suspension, permanent ban, or legal reporting.",
      },
    ],
  },
} satisfies Record<"terms" | "privacy" | "refund" | "prohibited", LegalDocument>;
