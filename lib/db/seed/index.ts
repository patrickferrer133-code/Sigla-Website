import { config } from "dotenv";
config({ path: ".env.local" });

import { faker } from "@faker-js/faker";
import { createClient } from "@supabase/supabase-js";
import { sql } from "drizzle-orm";
import { addDaysToIsoDate, denseDateSeries, weightTrendSeries } from "@/lib/domain/checkins";
import { SEED_EXERCISES } from "./exercises";

const SEED_PASSWORD = "SiglaSeed123!";
const SEED_EMAIL_DOMAIN = "sigla.seed";
const WEEKS_OF_HISTORY = 26; // ~6 months

function chunk<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < items.length; i += size) chunks.push(items.slice(i, i + size));
  return chunks;
}

async function main() {
  if (!process.env.DATABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("DATABASE_URL, NEXT_PUBLIC_SUPABASE_URL, and SUPABASE_SERVICE_ROLE_KEY must all be set in .env.local");
  }

  const { db } = await import("@/lib/db/client");
  const schema = await import("@/lib/db/schema");

  const [{ count: existingSeedCount }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(schema.users)
    .where(sql`${schema.users.email} like ${"%@" + SEED_EMAIL_DOMAIN}`);

  if (existingSeedCount > 0) {
    console.log(`Already seeded (${existingSeedCount} seed users found). Skipping. Wipe the DB first to reseed.`);
    process.exit(0);
  }

  const supabaseAdmin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

  console.log("Seeding exercise library...");
  const insertedExercises = await db
    .insert(schema.exercises)
    .values(
      SEED_EXERCISES.map((ex) => ({
        name: ex.name,
        primaryMuscle: ex.primaryMuscle,
        secondaryMuscles: ex.secondaryMuscles,
        movementPattern: ex.movementPattern,
        equipment: ex.equipment,
        isUnilateral: ex.isUnilateral ?? false,
        loadingType: ex.loadingType,
        difficulty: ex.difficulty,
        substitutionGroup: ex.substitutionGroup,
        contraindications: ex.contraindications,
        cues: ex.cues,
        isGlobal: true,
      })),
    )
    .returning({ id: schema.exercises.id, name: schema.exercises.name });

  const exerciseByName = new Map(insertedExercises.map((e) => [e.name, e.id]));
  const dayPlans = [
    {
      label: "Day A - Full Body",
      dayIndex: 0,
      exercises: ["Back Squat", "Bulgarian Split Squat", "Barbell Bench Press", "Seated Cable Row", "Plank"],
    },
    {
      label: "Day B - Full Body",
      dayIndex: 2,
      exercises: ["Overhead Press", "Lat Pulldown", "Dumbbell Bench Press", "One-Arm Dumbbell Row", "Dead Bug"],
    },
    {
      label: "Day C - Full Body",
      dayIndex: 4,
      exercises: ["Romanian Deadlift", "Walking Lunge", "Barbell Row", "Lateral Raise", "Farmer's Carry"],
    },
  ];

  async function createAuthUser(email: string, displayName: string) {
    const { data, error } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: SEED_PASSWORD,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error || !data.user) throw new Error(`Failed to create auth user ${email}: ${error?.message}`);
    return data.user.id;
  }

  console.log("Creating 10 coaches...");
  const specialtyPool = ["fat_loss", "strength", "hypertrophy", "sport", "rehab_adjacent"];
  const coaches: { id: string; userId: string; handle: string }[] = [];

  for (let i = 0; i < 10; i += 1) {
    const displayName = faker.person.fullName();
    const handle = faker.helpers.slugify(displayName).toLowerCase() + faker.number.int({ min: 1, max: 999 });
    const email = `coach${i + 1}@${SEED_EMAIL_DOMAIN}`;
    const userId = await createAuthUser(email, displayName);

    await db.insert(schema.users).values({
      id: userId,
      email,
      displayName,
      role: "coach",
      onboardingCompletedAt: faker.date.past({ years: 1 }),
    });

    const [coachProfile] = await db
      .insert(schema.coachProfiles)
      .values({
        userId,
        handle,
        headline: faker.helpers.arrayElement([
          "Helping busy beginners build a sustainable habit",
          "Strength coaching without the intimidation",
          "Fat loss coaching for people who hate diets",
          "Practical programming for real life",
        ]),
        bio: faker.lorem.paragraph(),
        yearsExperience: faker.number.int({ min: 1, max: 15 }),
        specialties: faker.helpers.arrayElements(specialtyPool, { min: 1, max: 3 }),
        languages: ["en", "tl"],
        coachingMode: faker.helpers.arrayElements(["online", "in_person"], { min: 1, max: 2 }),
        city: faker.helpers.arrayElement(["Manila", "Cebu", "Davao", "Quezon City", "Makati"]),
        country: "PH",
        verificationStatus: faker.helpers.arrayElement(["unverified", "unverified", "verified"]),
        tier: faker.helpers.arrayElement(["free", "free", "pro"]),
        ratingAvg: faker.number.float({ min: 4, max: 5, fractionDigits: 2 }).toFixed(2),
        ratingCount: faker.number.int({ min: 0, max: 40 }),
      })
      .returning({ id: schema.coachProfiles.id });

    coaches.push({ id: coachProfile.id, userId, handle });

    await db.insert(schema.packages).values([
      {
        coachId: coachProfile.id,
        title: "12-Week Coaching",
        description: "Full programming, weekly check-ins, and async chat.",
        priceCents: faker.number.int({ min: 3000, max: 8000 }) * 100,
        currency: "PHP",
        billingPeriod: "per_12_weeks",
        inclusions: ["Custom program", "Weekly check-in", "Chat support"],
        slotLimit: 20,
        slotsTaken: 0,
        isPublished: true,
      },
      {
        coachId: coachProfile.id,
        title: "Monthly Coaching",
        description: "Ongoing monthly coaching, cancel anytime.",
        priceCents: faker.number.int({ min: 1500, max: 3000 }) * 100,
        currency: "PHP",
        billingPeriod: "monthly",
        inclusions: ["Custom program", "Weekly check-in", "Chat support"],
        slotLimit: 25,
        slotsTaken: 0,
        isPublished: true,
      },
    ]);
  }

  console.log("Creating 60 clients...");
  const goalTypes = ["fat_loss", "muscle_gain", "strength", "health", "habit"] as const;
  const clients: {
    id: string;
    userId: string;
    displayName: string;
    startWeightKg: number;
    heightCm: number;
    goalType: (typeof goalTypes)[number];
  }[] = [];

  for (let i = 0; i < 60; i += 1) {
    const displayName = faker.person.fullName();
    const email = `client${i + 1}@${SEED_EMAIL_DOMAIN}`;
    const userId = await createAuthUser(email, displayName);

    await db.insert(schema.users).values({
      id: userId,
      email,
      displayName,
      role: "client",
      onboardingCompletedAt: faker.date.past({ years: 1 }),
    });

    const sexAtBirth = faker.helpers.arrayElement(["male", "female"] as const);
    const heightCm = sexAtBirth === "male" ? faker.number.int({ min: 160, max: 190 }) : faker.number.int({ min: 150, max: 175 });
    const startWeightKg = sexAtBirth === "male" ? faker.number.int({ min: 65, max: 100 }) : faker.number.int({ min: 50, max: 85 });
    const goalType = faker.helpers.arrayElement(goalTypes);

    const [clientProfile] = await db
      .insert(schema.clientProfiles)
      .values({
        userId,
        dateOfBirth: faker.date.birthdate({ min: 18, max: 55, mode: "age" }).toISOString().slice(0, 10),
        sexAtBirth,
        heightCm: heightCm.toString(),
        trainingAgeMonths: faker.number.int({ min: 0, max: 60 }),
        equipmentAccess: faker.helpers.arrayElements(["barbell", "dumbbell", "kettlebell", "machine", "cable", "bodyweight"], { min: 2, max: 6 }),
        privacyPrefs: { hideWeight: true, hidePhotos: true, anonymousInCommunity: true },
      })
      .returning({ id: schema.clientProfiles.id });

    clients.push({ id: clientProfile.id, userId, displayName, startWeightKg, heightCm, goalType });
  }

  console.log("Creating engagements and packages assignments...");
  const engagements: { id: string; coachId: string; clientId: string; startedAt: Date }[] = [];
  for (let i = 0; i < clients.length; i += 1) {
    const coach = coaches[i % coaches.length];
    const startedAt = faker.date.recent({ days: 220 });
    const [engagement] = await db
      .insert(schema.engagements)
      .values({
        coachId: coach.id,
        clientId: clients[i].id,
        status: "active",
        startedAt,
      })
      .returning({ id: schema.engagements.id });
    engagements.push({ id: engagement.id, coachId: coach.id, clientId: clients[i].id, startedAt });
  }

  console.log("Creating intakes, goals, and safety screens...");
  const intakeRows = clients.map((client) => ({
    clientId: client.id,
    engagementId: engagements.find((e) => e.clientId === client.id)!.id,
    parqAnswers: {
      cardiacSymptoms: false,
      chestPain: false,
      dizzinessOrLossOfConsciousness: false,
      uncontrolledBloodPressure: false,
      doctorSupervisionRequired: false,
    },
    parqFlagged: false,
    medicalClearanceStatus: "not_required" as const,
    daysAvailable: faker.number.int({ min: 3, max: 5 }),
    sessionMinutesMax: faker.helpers.arrayElement([30, 45, 60]),
    sleepHours: faker.number.int({ min: 5, max: 9 }).toString(),
    stressLevel: faker.number.int({ min: 1, max: 5 }),
    stepBaseline: faker.number.int({ min: 3000, max: 10000 }),
    submittedAt: faker.date.recent({ days: 220 }),
  }));
  await db.insert(schema.intakes).values(intakeRows);

  const goalRows = clients.map((client) => {
    const targetDate = faker.date.soon({ days: 180 });
    const isWeightGoal = client.goalType === "fat_loss" || client.goalType === "muscle_gain";
    const delta = client.goalType === "fat_loss" ? -faker.number.int({ min: 3, max: 8 }) : client.goalType === "muscle_gain" ? faker.number.int({ min: 2, max: 5 }) : 0;
    return {
      clientId: client.id,
      type: client.goalType,
      isPrimary: true,
      targetMetric: isWeightGoal ? ("bodyweight_kg" as const) : ("sessions_per_week" as const),
      targetValue: (isWeightGoal ? client.startWeightKg + delta : 4).toString(),
      targetDate: targetDate.toISOString().slice(0, 10),
      whyNow: faker.lorem.sentence(),
      successDefinition: faker.lorem.sentence(),
      realismVerdict: "realistic" as const,
      status: "active" as const,
    };
  });
  await db.insert(schema.goals).values(goalRows);

  console.log("Building each coach's program template...");
  const templateByCoach = new Map<string, { programId: string }>();
  for (const coach of coaches) {
    const [template] = await db
      .insert(schema.programs)
      .values({
        coachId: coach.id,
        isTemplate: true,
        title: "Full Body Foundations",
        description: "A 4-week full body template, 3 sessions per week.",
        goalType: "health",
        weeksTotal: 4,
        status: "active",
      })
      .returning({ id: schema.programs.id });
    templateByCoach.set(coach.id, { programId: template.id });
  }

  console.log("Cloning programs and generating 6 months of session logs and checkins per client (this takes a while)...");

  const allSessionLogs: (typeof schema.sessionLogs.$inferInsert)[] = [];
  const allSetLogs: (typeof schema.setLogs.$inferInsert)[] = [];
  const allCheckins: (typeof schema.checkins.$inferInsert)[] = [];
  const allMetricsDaily: (typeof schema.clientMetricsDaily.$inferInsert)[] = [];

  for (const client of clients) {
    const engagement = engagements.find((e) => e.clientId === client.id)!;

    // -- Clone a 4-week prescribed program for this client --
    const [program] = await db
      .insert(schema.programs)
      .values({
        coachId: engagement.coachId,
        engagementId: engagement.id,
        isTemplate: false,
        title: "Full Body Foundations",
        goalType: client.goalType,
        weeksTotal: 4,
        status: "active",
        startsOn: engagement.startedAt.toISOString().slice(0, 10),
      })
      .returning({ id: schema.programs.id });

    const [block] = await db
      .insert(schema.blocks)
      .values({ programId: program.id, name: "Foundations", focus: "base", orderIndex: 0, weeks: 4 })
      .returning({ id: schema.blocks.id });

    const strengthMultiplier = faker.number.float({ min: 0.7, max: 1.4, fractionDigits: 2 });
    const prescribedSessionsByWeekDay: { sessionId: string; dayPlanIndex: number }[] = [];

    for (let week = 1; week <= 4; week += 1) {
      const [programWeek] = await db
        .insert(schema.programWeeks)
        .values({ blockId: block.id, weekNumber: week, isDeload: week === 4 })
        .returning({ id: schema.programWeeks.id });

      for (let dayPlanIndex = 0; dayPlanIndex < dayPlans.length; dayPlanIndex += 1) {
        const dayPlan = dayPlans[dayPlanIndex];
        const [session] = await db
          .insert(schema.sessions)
          .values({
            programWeekId: programWeek.id,
            name: dayPlan.label,
            dayIndex: dayPlan.dayIndex,
            estimatedMinutes: 50,
            orderIndex: dayPlanIndex,
          })
          .returning({ id: schema.sessions.id });

        prescribedSessionsByWeekDay.push({ sessionId: session.id, dayPlanIndex });

        for (let exIndex = 0; exIndex < dayPlan.exercises.length; exIndex += 1) {
          const exerciseId = exerciseByName.get(dayPlan.exercises[exIndex]);
          if (!exerciseId) continue;

          const [group] = await db
            .insert(schema.exerciseGroups)
            .values({ sessionId: session.id, kind: "straight", label: String.fromCharCode(65 + exIndex), restSeconds: 90, orderIndex: exIndex })
            .returning({ id: schema.exerciseGroups.id });

          const [instance] = await db
            .insert(schema.exerciseInstances)
            .values({ exerciseGroupId: group.id, exerciseId, orderIndex: 0 })
            .returning({ id: schema.exerciseInstances.id });

          const baseLoadKg = Math.round(20 * strengthMultiplier * (1 + week * 0.02));
          await db.insert(schema.setPrescriptions).values(
            Array.from({ length: 3 }, (_, setIdx) => ({
              exerciseInstanceId: instance.id,
              setNumber: setIdx + 1,
              setType: "working" as const,
              repsMode: "range" as const,
              repsMin: 8,
              repsMax: 12,
              load: { type: "kg" as const, value: baseLoadKg },
              restSeconds: 90,
            })),
          );
        }
      }
    }

    // -- Generate 26 weeks of session + set logs --
    const bodyweightTrajectory: { date: Date; weightKg: number }[] = [];
    let currentWeight = client.startWeightKg;
    const weeklyDelta = client.goalType === "fat_loss" ? -faker.number.float({ min: 0.2, max: 0.5, fractionDigits: 2 }) : client.goalType === "muscle_gain" ? faker.number.float({ min: 0.05, max: 0.15, fractionDigits: 2 }) : faker.number.float({ min: -0.05, max: 0.05, fractionDigits: 2 });

    for (let week = 0; week < WEEKS_OF_HISTORY; week += 1) {
      const weekStart = new Date(engagement.startedAt.getTime() + week * 7 * 24 * 60 * 60 * 1000);
      currentWeight = Math.max(45, currentWeight + weeklyDelta + faker.number.float({ min: -0.3, max: 0.3, fractionDigits: 2 }));

      // Weigh-ins on most days, with real skipped days. A 7-day trend needs
      // at least 3 weigh-ins in the trailing week to exist at all (docs/06
      // section 3), so seeding two a week would leave every trend value null
      // and there would be nothing to build the chart against.
      for (let dayOffset = 0; dayOffset < 7; dayOffset += 1) {
        if (faker.number.float({ min: 0, max: 1 }) > 0.75) continue; // ~5 weigh-ins a week
        const date = new Date(weekStart.getTime() + dayOffset * 24 * 60 * 60 * 1000);
        bodyweightTrajectory.push({ date, weightKg: currentWeight + faker.number.float({ min: -0.4, max: 0.4, fractionDigits: 2 }) });
      }

      const adherenceRoll = faker.number.float({ min: 0.55, max: 1 });

      for (let dayPlanIndex = 0; dayPlanIndex < dayPlans.length; dayPlanIndex += 1) {
        const wasCompleted = faker.number.float({ min: 0, max: 1 }) <= adherenceRoll;
        const sessionDate = new Date(weekStart.getTime() + dayPlans[dayPlanIndex].dayIndex * 24 * 60 * 60 * 1000);
        if (sessionDate > new Date()) continue;

        const prescribed = week < 4 ? prescribedSessionsByWeekDay.find((s) => s.dayPlanIndex === dayPlanIndex && prescribedSessionsByWeekDay.indexOf(s) === week * 3 + dayPlanIndex) : undefined;

        const sessionLogId = crypto.randomUUID();
        allSessionLogs.push({
          id: sessionLogId,
          sessionId: week < 4 ? prescribed?.sessionId : null,
          clientId: client.id,
          engagementId: engagement.id,
          startedAt: sessionDate,
          completedAt: wasCompleted ? sessionDate : null,
          status: wasCompleted ? "completed" : "skipped",
          skipReason: wasCompleted ? null : faker.helpers.arrayElement(["too busy", "felt unwell", "travel"]),
          sessionRpe: wasCompleted ? faker.number.int({ min: 5, max: 9 }) : null,
          mood: faker.number.int({ min: 2, max: 5 }),
          energy: faker.number.int({ min: 2, max: 5 }),
        });

        if (!wasCompleted) continue;

        const progressionFactor = 1 + week * 0.015;
        for (const exerciseName of dayPlans[dayPlanIndex].exercises) {
          const exerciseId = exerciseByName.get(exerciseName);
          if (!exerciseId) continue;
          const baseLoadKg = 20 * strengthMultiplier * progressionFactor;
          const reportsPain = faker.number.float({ min: 0, max: 1 }) < 0.03;

          for (let setNumber = 1; setNumber <= 3; setNumber += 1) {
            allSetLogs.push({
              sessionLogId,
              exerciseId,
              setNumber,
              reps: faker.number.int({ min: 7, max: 12 }),
              loadKg: Math.round(baseLoadKg + setNumber * 1.25).toString(),
              rpe: faker.number.int({ min: 6, max: 9 }).toString(),
              painReported: reportsPain,
              painSite: reportsPain ? faker.helpers.arrayElement(["knee", "shoulder", "lower_back"]) : null,
              painScore: reportsPain ? faker.number.int({ min: 3, max: 8 }) : null,
              loggedAt: sessionDate,
            });
          }
        }
      }

      // Weekly check-in, ~85% submission rate.
      if (faker.number.float({ min: 0, max: 1 }) < 0.85 && weekStart <= new Date()) {
        allCheckins.push({
          engagementId: engagement.id,
          clientId: client.id,
          weekOf: weekStart.toISOString().slice(0, 10),
          bodyweightKg: currentWeight.toFixed(1),
          measurements: { waistCm: faker.number.int({ min: 65, max: 100 }) },
          adherenceTrainingPct: Math.round(adherenceRoll * 100),
          adherenceNutritionPct: faker.number.int({ min: 50, max: 100 }),
          avgSteps: faker.number.int({ min: 3000, max: 12000 }),
          avgSleepHours: faker.number.int({ min: 5, max: 9 }).toString(),
          energy: faker.number.int({ min: 1, max: 5 }),
          hunger: faker.number.int({ min: 1, max: 5 }),
          stress: faker.number.int({ min: 1, max: 5 }),
          motivation: faker.number.int({ min: 1, max: 5 }),
          soreness: faker.number.int({ min: 1, max: 5 }),
          mood: faker.number.int({ min: 1, max: 5 }),
          wentWell: faker.lorem.sentence(),
          gotInTheWay: faker.lorem.sentence(),
          submittedAt: new Date(weekStart.getTime() + 7 * 24 * 60 * 60 * 1000),
        });
      }
    }

    // -- Roll bodyweight trajectory into client_metrics_daily --
    //
    // This must go through the same dense-array + minObservations path the
    // app uses (lib/checkins/service.ts recomputeWeightTrend). The previous
    // version called rollingAverage() directly on a compacted array of only
    // the days that had a weigh-in, which is index-based: with two weigh-ins
    // a week, a "7-day trend" actually averaged 3.5 weeks of calendar time,
    // and the first point was a single raw weight. The charts read this
    // column and label it "7-day trend", so the seed was manufacturing
    // exactly the single-number-as-fact display docs/06 section 3 forbids.
    const sortedTrajectory = bodyweightTrajectory.sort((a, b) => a.date.getTime() - b.date.getTime());
    if (sortedTrajectory.length > 0) {
      const firstIsoDate = sortedTrajectory[0].date.toISOString().slice(0, 10);
      const lastIsoDate = sortedTrajectory[sortedTrajectory.length - 1].date.toISOString().slice(0, 10);
      const points = sortedTrajectory.map((p) => ({ date: p.date.toISOString().slice(0, 10), value: p.weightKg }));
      const dense = denseDateSeries(firstIsoDate, lastIsoDate, points);
      const trend = weightTrendSeries(dense, { windowDays: 7, minObservations: 3 });

      let cursor = firstIsoDate;
      for (let i = 0; i < dense.length; i += 1) {
        const rawKg = dense[i];
        // Days with neither a weigh-in nor a trend carry no bodyweight data.
        if (rawKg !== null || trend[i] !== null) {
          allMetricsDaily.push({
            clientId: client.id,
            date: cursor,
            bodyweightKg: rawKg !== null ? rawKg.toFixed(2) : null,
            bodyweightTrendKg: trend[i] !== null ? trend[i]!.toFixed(2) : null,
          });
        }
        cursor = addDaysToIsoDate(cursor, 1);
      }
    }
  }

  console.log(`Inserting ${allSessionLogs.length} session logs...`);
  for (const batch of chunk(allSessionLogs, 500)) {
    await db.insert(schema.sessionLogs).values(batch);
  }

  console.log(`Inserting ${allSetLogs.length} set logs...`);
  for (const batch of chunk(allSetLogs, 500)) {
    await db.insert(schema.setLogs).values(batch);
  }

  console.log(`Inserting ${allCheckins.length} check-ins...`);
  for (const batch of chunk(allCheckins, 500)) {
    await db.insert(schema.checkins).values(batch);
  }

  console.log(`Inserting ${allMetricsDaily.length} daily metric rows...`);
  for (const batch of chunk(allMetricsDaily, 500)) {
    await db
      .insert(schema.clientMetricsDaily)
      .values(batch)
      .onConflictDoNothing({ target: [schema.clientMetricsDaily.clientId, schema.clientMetricsDaily.date] });
  }

  console.log("Seeding a global community and a few coach posts...");
  const [globalCommunity] = await db
    .insert(schema.communities)
    .values({ kind: "global_goal", name: "Getting Started", description: "For anyone starting out.", goalTag: "habit", joinPolicy: "open" })
    .returning({ id: schema.communities.id });

  await db.insert(schema.communityMemberships).values(
    clients.slice(0, 20).map((client) => ({
      communityId: globalCommunity.id,
      userId: client.userId,
      displayAlias: faker.internet.username(),
    })),
  );

  await db.insert(schema.coachPosts).values(
    coaches.map((coach) => ({
      coachId: coach.id,
      kind: "article" as const,
      title: faker.lorem.sentence({ min: 4, max: 8 }),
      bodyMd: faker.lorem.paragraphs(2),
      tags: ["education"],
      visibility: "public" as const,
      publishedAt: faker.date.recent({ days: 110 }),
    })),
  );

  console.log("Seeding a couple of chat messages per engagement...");
  const messageRows = engagements.flatMap((engagement) => {
    const coach = coaches.find((c) => c.id === engagement.coachId)!;
    const client = clients.find((c) => c.id === engagement.clientId)!;
    return [
      { engagementId: engagement.id, senderUserId: coach.userId, body: "Welcome aboard! Excited to get started.", createdAt: engagement.startedAt },
      { engagementId: engagement.id, senderUserId: client.userId, body: "Thank you, looking forward to it!", createdAt: engagement.startedAt },
    ];
  });
  for (const batch of chunk(messageRows, 500)) {
    await db.insert(schema.messages).values(batch);
  }

  console.log("Done. Seeded 10 coaches and 60 clients.");
  console.log(`All seed accounts share the password: ${SEED_PASSWORD}`);
  console.log("Example logins: coach1@sigla.seed, client1@sigla.seed");
  process.exit(0);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
