# 01 - Domain Knowledge: How Gym Coaching Systems Actually Work

This is the reference document. Every feature decision in this project should trace back to something in here. If a feature does not map to a real step in a coach's workflow or a real client behaviour, it is decoration.

---

## 1. What a coaching business really is

A coach is not selling "workouts". Workouts are free on YouTube. A coach sells four things:

1. Assessment: figuring out where this specific person actually is right now.
2. Prescription: deciding what they should do next, and in what order.
3. Accountability: making sure it gets done.
4. Adjustment: changing the plan when reality does not match the plan.

Software can fully own #1 (structured intake), mostly own #2 (program builder), heavily assist #3 (check-ins, reminders, streaks, community), and lightly assist #4 (flagging when a client stalls). A platform that only does #2 becomes a spreadsheet with a logo. Most competitors die here.

The strategic implication: our differentiation is in #3 and #4, not in the program builder.

---

## 2. The coaching lifecycle

This is the pipeline every coaching business runs, whether they know it or not. The software should have a surface for each stage.

| Stage | What happens | Software surface |
|---|---|---|
| 1. Discovery | Client finds the coach | Marketplace search, coach personal page, pushed content |
| 2. Qualification | Coach checks fit, client checks price | Pricing in bio, packages, application form, quiz funnel |
| 3. Intake | Health screen, goals, history, logistics | Intake form, PAR-Q+, waiver, goal setter |
| 4. Assessment | Baseline numbers and movement quality | Assessment record, starting stats, optional video screen |
| 5. Program design | Build the plan | Program builder, templates, exercise library |
| 6. Delivery | Client trains and logs | Client app view, workout logger, timers, demo videos |
| 7. Check-in | Weekly data and conversation | Check-in form, photos, trend charts, chat |
| 8. Adjustment | Coach changes load, volume, calories, exercises | Program edit, versioning, change log |
| 9. Retention | Client keeps paying and keeps going | Community, progress milestones, streaks, renewal |
| 10. Offboarding or referral | Ends well, refers others | Exit survey, referral link, alumni access |

Stages 2 and 9 are where money is made or lost. Stages 5 and 6 are where every competitor puts their effort.

---

## 3. Program architecture: the training object model

This is the hierarchy that all serious training software uses. Get this data model wrong and nothing else can be built on top of it.

```
Program (the whole plan, e.g. "12-Week Fat Loss")
 └── Block / Mesocycle (3 to 6 weeks with one focus)
      └── Week / Microcycle
           └── Session (one gym visit, e.g. "Day A - Lower Push")
                └── Exercise Group (straight set, superset, circuit, giant set, EMOM)
                     └── Exercise Instance (this exercise, in this slot)
                          └── Set Prescription (what to do on set 1, 2, 3...)
                               └── Set Log (what the client actually did)
```

Critical detail most builders miss: prescription and log are two different objects. The coach prescribes "3 x 8 to 10 at RPE 8". The client logs "8 reps at 60kg RPE 9, 8 reps at 60kg RPE 9.5, 6 reps at 60kg failure". The gap between prescribed and actual is the single most valuable data point in the entire system. It drives adherence scoring, progression logic, and coach alerts.

Second critical detail: programs must be versioned. When a coach changes week 4 while the client is in week 3, you need history. Never destructively edit a program a client is mid-way through.

---

## 4. The exercise library

The exercise library is the spine. Every exercise needs:

- Name, and aliases (Romanian deadlift = RDL = stiff leg deadlift, roughly)
- Primary muscle group, secondary muscle groups
- Movement pattern: squat, hinge, horizontal push, horizontal pull, vertical push, vertical pull, lunge, carry, rotation, anti-rotation, isolation, conditioning
- Equipment required: barbell, dumbbell, kettlebell, machine, cable, band, bodyweight, none
- Unilateral flag (affects how reps are recorded: per side or total)
- Loading type: external load, bodyweight, bodyweight plus load, time, distance, calories
- Demo video and thumbnail
- Coaching cues (short text the client sees mid-set)
- Difficulty tier and progressions / regressions (goblet squat regresses to box squat, progresses to front squat)
- Substitution group (so a client without a cable machine gets a valid swap automatically)
- Contraindication tags (lower back, shoulder, knee, pregnancy) so it can be filtered out for injured clients

Two libraries exist: the global platform library (curated, verified, video-backed) and the coach's private library (their own variations and their own filmed demos). Coaches will not adopt a platform that forces them to abandon their own exercise names.

Substitution groups plus equipment tags are what allow the "home gym vs commercial gym" problem to be solved automatically. This is a high-value, low-effort feature.

---

## 5. Prescription grammar

A set prescription is not just "3 x 10". The full grammar:

- Sets: fixed count, or "work up to" style
- Reps: fixed (8), range (8 to 10), AMRAP (as many as possible), time (30s), distance, calories
- Load: absolute (60kg), percentage of 1RM (75%), percentage of estimated 1RM, RPE target, RIR target (reps in reserve), bodyweight, band colour, "same as last week", "last week plus 2.5kg"
- Tempo: four digit code, eccentric / pause / concentric / pause. 3010 means 3 seconds down, no pause, 1 second up, no pause
- Rest: seconds between sets
- Set type: warmup, working, backoff, drop set, cluster, myo-reps, failure
- Notes: free text from coach for that exercise

The load field is the hard one. It must be a polymorphic value, not a number. Model it as `{ type, value, unit, reference }`.

RPE and RIR are the modern standard because they self-correct for daily readiness. RPE 8 means "two reps left in the tank". RIR 2 is the same thing expressed differently. Support both, let the coach pick their dialect, store one canonical form.

---

## 6. Progression models

The coach needs the system to answer "what load should the client use this week". The common models:

1. Linear progression: add a fixed increment each session or week. Works for beginners for about 3 to 6 months, then stalls.
2. Double progression: keep load, push reps to the top of the range, then add load and drop back to the bottom of the range. The most common intermediate model and the easiest to automate.
3. Percentage based: prescribed off a tested or estimated 1RM. Needs periodic retesting.
4. RPE anchored: the client chooses load to hit the target RPE. Self-regulating, needs an educated client.
5. Autoregulated by readiness: adjust today's volume or load based on a pre-session readiness score (sleep, soreness, stress, energy).
6. Deload: a planned lighter week every 4 to 8 weeks, or triggered by fatigue markers.

Estimated 1RM formulas the platform should compute automatically from logged sets:
- Epley: `1RM = weight x (1 + reps / 30)`
- Brzycki: `1RM = weight x 36 / (37 - reps)`

Store both, display one, use e1RM trend as the primary strength progress chart. It is far more motivating than a raw weight chart because it moves even when the load does not.

Volume load = sets x reps x load. Weekly volume per muscle group is the standard hypertrophy tracking metric. Hard sets per muscle per week is the more useful modern metric (roughly 10 to 20 for most trainees).

---

## 7. Periodization models

The coach picks a structure for the macrocycle:

- Linear: volume down, intensity up over time. Simple, good for novices and peaking.
- Undulating (DUP): intensity and volume vary within the week. Good for intermediates who get bored.
- Block: distinct phases. Accumulation (volume) then intensification (load) then realization (peak or test).
- Conjugate: max effort and dynamic effort work concurrently. Advanced, powerlifting oriented.

The software does not need to enforce these. It needs to make them expressible: a Block object with a name, a focus tag, a duration, and a deload flag is enough.

---

## 8. Intake and assessment

This is the part that makes a coach look like a professional instead of a random person selling PDFs.

Health screening (mandatory, gating):
- PAR-Q+ style questionnaire. Any yes answer on cardiac symptoms, chest pain, dizziness, uncontrolled blood pressure, or medical supervision needs a medical clearance flag before programming can start.
- Injury history: site, date, current pain level, movements that aggravate it. Feeds exercise contraindication filters.
- Medications and conditions relevant to exercise tolerance.
- Pregnancy or postpartum status.

Goals:
- Primary goal, one only. Coaches know that "lose fat and gain 10kg of muscle and run a marathon" is not a plan.
- Timeline and why now. The "why" is the retention lever, capture it and show it back to the client when adherence dips.
- Success definition in the client's own words, not just a number.

Logistics:
- Training days available per week, session length ceiling, equipment access, gym or home, travel patterns.
- Sleep hours, occupation activity level, step baseline, stress level.

Baseline data:
- Height, weight, optional circumference measurements, optional photos, optional body fat estimate.
- Strength baselines on 3 to 5 key lifts, tested or estimated.
- Conditioning baseline if relevant.

Movement screen (optional, video-based): overhead squat, hinge, push-up, single leg. Client records, coach reviews asynchronously. This is a strong premium differentiator and cheap to build once video review exists.

---

## 9. Nutrition layer, and its legal edge

Most coaching relationships include nutrition. Handle it carefully.

Calculation chain:
1. BMR via Mifflin-St Jeor: men `10w + 6.25h - 5a + 5`, women `10w + 6.25h - 5a - 161` (w in kg, h in cm, a in years). Katch-McArdle if body fat is known.
2. TDEE = BMR x activity factor (1.2 sedentary to 1.9 very active), or BMR + estimated NEAT + exercise burn.
3. Target = TDEE plus or minus a deficit or surplus. Standard safe range is roughly 10 to 20 percent.
4. Protein first (roughly 1.6 to 2.2 g/kg), fat floor (roughly 0.6 to 1.0 g/kg), carbs fill the remainder.

Coaching approaches, in order of client burden:
- Habit based: no numbers, behaviours only. Best for beginners and best for adherence.
- Portion or hand based: palm of protein, fist of veg, cupped hand of carbs, thumb of fat.
- Flexible macros: full tracking.
- Meal plans: fixed meals. Highest compliance short term, worst long term skill transfer.

Scope of practice: in most jurisdictions a non-dietitian coach may give general nutrition guidance but may not provide medical nutrition therapy or treat disease. The product must not let a coach prescribe nutrition to someone who has flagged a medical condition without a clearance step, and must carry a clear disclaimer. See doc 06.

Safety floors the software enforces regardless of what a coach types in: see doc 06, section on disordered eating safeguards. These are non-negotiable and are a product feature, not a compliance chore.

---

## 10. Adherence, check-ins, and the metrics that matter

Weekly check-in is the heartbeat of online coaching. A standard check-in captures:

- Bodyweight: daily weigh-ins averaged weekly. Never coach off a single weigh-in. Show a 7 day rolling average as the primary line and raw dots as secondary. This one design choice removes an enormous amount of client anxiety.
- Measurements: waist is the highest signal single measurement.
- Photos: front, side, back. Optional. Must be private by default and never auto-shared.
- Adherence self-report: training sessions completed, nutrition adherence percent, step average, sleep average.
- Subjective: energy, hunger, stress, motivation, soreness, mood. 1 to 5 scales.
- Free text: what went well, what got in the way.

Computed metrics the platform should own:
- Session completion rate (sessions logged / sessions prescribed)
- Set completion rate and prescribed vs actual load delta
- Streak length and longest streak
- Check-in submission rate
- Rolling weight trend slope
- e1RM trend per key lift
- Weekly hard sets per muscle group
- Days since last app open, days since last coach message

Coach-facing alerting is where the real product value sits. The system should surface: "3 clients missed 2 or more sessions this week", "1 client has not opened the app in 9 days", "1 client's weight trend is flat for 3 weeks against a fat loss goal", "1 client reported pain on 2 exercises". A coach with 40 clients cannot do this manually. This is the feature that justifies a premium tier.

---

## 11. Video form review loop

The highest perceived-value interaction in online coaching. The flow:

1. Client records a set on their phone.
2. Uploads against a specific exercise in a specific logged session.
3. Coach gets a queue item.
4. Coach reviews, and replies with either timestamped text comments, a voice note over the video, or a screen-recorded reply.
5. Client sees the review attached to that exercise forever.

Technical implications: video storage and transcoding cost real money. Cap durations (30 to 60 seconds), transcode to a compressed rendition, expire raw uploads after a retention window, and put the whole feature behind a paid tier.

---

## 12. Behaviour change layer

Programs fail on behaviour, not on exercise selection. The mechanisms that actually work:

- Minimum viable behaviour: define a floor version of every habit. "If I cannot do 45 minutes, I do 10 minutes." Floors protect streaks, and protected streaks protect identity.
- Implementation intentions: "After I drop the kids at school, I go to the gym." Capture the when and where, not just the what.
- Habit stacking and streaks, with grace days so one miss does not destroy motivation. A streak that breaks permanently at one miss is actively harmful to a nervous beginner.
- Progress that is not weight: sessions completed, total volume lifted, e1RM gains, steps, sleep, photos. A judgement-free product leads with these.
- Social proof from peers at the same stage, not from finished physiques.

---

## 13. Coach economics

Understand this or the pricing model will be wrong.

- A solo online coach caps out around 25 to 60 clients depending on service depth. Time per client per week is roughly 20 to 60 minutes.
- Common price points range widely by market. In the Philippines, online coaching commonly sits far below US and EU rates, so a flat platform subscription in USD can be brutal for local coaches. Tier pricing by market or by client count.
- Pricing models: monthly retainer, 8 or 12 week package (higher upfront, better completion), pay-per-program (low value, high churn), hybrid retainer plus in-person sessions.
- Churn is the killer. Typical online coaching churn is 5 to 15 percent monthly. LTV = ARPU / churn rate. A coach at 250 USD per month with 10 percent churn has an LTV of 2500 USD. Everything the platform does to reduce churn is directly monetizable.
- Coach acquisition cost matters to them. The funnel tools we gate behind premium are the thing they will actually pay for, because they map to revenue, not convenience.

---

## 14. What existing platforms do, and where the gaps are

Category leaders (Trainerize, TrueCoach, Everfit, PT Distinction, Kahunas, and similar) generally cover: program builder, exercise library, client app, logging, check-ins, chat, basic payments.

Consistent weak points, which are our openings:

1. They are coach tools, not marketplaces. Coaches must bring their own clients. Our marketplace and content push directly attacks this.
2. Client experience is transactional and often intimidating. Weight-first dashboards, before-and-after culture, no peer community. Our judgement-free positioning attacks this.
3. Community is either absent or dumped into a separate Facebook group the coach has to moderate manually.
4. Funnel and CRM tooling is thin. Coaches bolt on separate tools for lead capture, calls, and follow-up.
5. Goal setting is a text box. Nothing enforces realism. Our realistic-goals engine attacks this.
6. Almost nothing is localized for Southeast Asia: pricing, payment rails, food databases, gym equipment realities.

Positioning statement to work from:
"The coaching platform where clients are not judged and coaches do not have to find clients alone."

---

## 15. Glossary

- 1RM: one rep max. e1RM is the estimated version.
- AMRAP: as many reps as possible.
- Deload: planned recovery week with reduced load or volume.
- DUP: daily undulating periodization.
- Hard set: a working set taken close to failure, roughly 0 to 3 reps in reserve.
- Hypertrophy: muscle growth.
- Mesocycle: a training block, typically 3 to 6 weeks.
- Microcycle: usually one week.
- NEAT: non-exercise activity thermogenesis, daily movement outside training.
- PAR-Q+: physical activity readiness questionnaire, the standard pre-exercise health screen.
- Progressive overload: gradually increasing demand over time. The core principle of all training.
- RIR: reps in reserve.
- RPE: rate of perceived exertion, usually a 1 to 10 scale.
- TDEE: total daily energy expenditure.
- Tempo: the speed code of a rep, e.g. 3010.
- Volume load: sets x reps x load.
