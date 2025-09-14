import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
	// Create a sample user to own the lesson
	const sampleUser = await prisma.user.upsert({
		where: { email: "tutor@example.com" },
		update: {},
		create: {
			email: "tutor@example.com",
			name: "Sample Tutor",
		},
	});

	// Check if lesson already exists
	let ruhiLesson = await prisma.lesson.findFirst({
		where: {
			title:
				"Reflections on the Life of the Spirit: Understanding Writings and Prayer",
			creatorId: sampleUser.id,
		},
	});

	// Create the Ruhi Institute lesson if it doesn't exist
	if (!ruhiLesson) {
		ruhiLesson = await prisma.lesson.create({
			data: {
				title:
					"Reflections on the Life of the Spirit: Understanding Writings and Prayer",
				description:
					"A foundational course introducing participants to the path of service through understanding Bahá'í writings, developing habits of prayer, and contemplating the nature of life and death. This course traces a path of service to humanity, focusing on spiritual and intellectual growth while contributing to the transformation of society.",
				content: `# Reflections on the Life of the Spirit - Book 1

## Introduction: The Path of Service

This course introduces the concept of a "path of service" - a journey we each walk at our own pace, assisting and being assisted by others. Progress on this path requires developing capabilities through understanding, spiritual qualities, and practical skills.

The twofold moral purpose of this path is:
1. To attend to one's own spiritual and intellectual growth
2. To contribute to the transformation of society

## Unit 1: Understanding the Bahá'í Writings

### Learning to Read Sacred Text

Reading from Holy Writings is different from ordinary reading. This unit fosters the habit of daily reading and meditation on Sacred Text.

#### Levels of Understanding

**1. Immediate Meaning**
- Start with the obvious, literal meaning
- Example: "The betterment of the world can be accomplished through pure and goodly deeds, through commendable and seemly conduct"
- Question: How can the betterment of the world be accomplished?

**2. Practical Application** 
- Identify concrete expressions of spiritual principles
- Determine which characteristics are commendable
- Example: Consider whether truthfulness is "the foundation of all human virtues"

**3. Implications and Deeper Meaning**
- Explore what passages mean for daily life
- Challenge contradictory statements through spiritual reasoning
- Example: "Bring thyself to account each day ere thou art summoned to a reckoning" - what does this imply about confession?

### Facilitator Guidance
- Avoid prolonged discussions of single words out of context
- Focus on thoughtful analysis rather than mere opinion
- Maintain reasonable rhythm of progress
- Ensure every participant remains engaged

## Unit 2: Prayer and Spiritual Life

### The Significance of Prayer

Prayer is as crucial for the human soul as food is for nourishing the body. This unit explores:

#### What It Means to Pray
- "Conversing with God" and drawing near to Him
- Entering into a proper state of prayer
- The posture of our hearts and minds
- Creating appropriate conditions for prayer

#### Individual and Communal Prayer
- Personal prayer and meditation
- The forces generated through communal worship  
- Hosting gatherings for prayer and devotions

#### Beyond Ritual
- Moving past mere form to focus on inner state
- Understanding prayer as spiritual nourishment
- Developing sincere spiritual connection

## Unit 3: Life and Death

### The Nature of the Soul

The soul and body together constitute the human being in this plane of existence. Key concepts:

#### Soul-Body Relationship
- The soul is not physical - it's like light appearing in a mirror
- Neither dust nor destruction of the mirror affects the light's splendor
- Death is simply a change of condition when soul-body association breaks

#### The Soul's Journey
- The soul progresses eternally towards its Creator
- Death is not an end but a transition
- Spiritual faculties developed here assist us in the next world

### Purpose of Life

#### In This World
- To know God and attain His presence
- The soul can reflect all of God's names and attributes
- Potential is latent and requires spiritual education through Divine Manifestations

#### After Death
- Those faithful to God attain true happiness
- We cannot know our own end - therefore forgive others
- Continued progression and spiritual development
- Recognition of loved ones and companionship with holy souls
- Memory of this life continues

### Practical Application
Reflect on the implications of these teachings for daily life, remembering that the changes and chances of this world need not bring us sorrow.

## Discussion Questions for Facilitators

1. How does understanding the immediate meaning of passages strengthen unity of thought in consultation?

2. What are the conditions that should be created for meaningful prayer, both alone and in gatherings?

3. How does understanding the eternal nature of the soul affect our approach to service and relationships?

4. What does it mean to walk "the path of service" in practical terms?

5. How can we balance attention to our own spiritual growth with contribution to society's transformation?

## Exercises for Participants

### Understanding Exercises
- Identify commendable characteristics from given passages
- Analyze implications of spiritual principles
- Apply truthfulness as foundation for other virtues

### Prayer Exercises  
- Plan and host a devotional gathering
- Establish personal prayer routine
- Explore different prayer states and conditions

### Life Purpose Exercises
- Reflect on how soul-body relationship affects daily choices
- Consider what spiritual faculties we're developing
- Contemplate the eternal journey ahead`,

				objectives: [
					"Develop the habit of reading sacred texts daily with meditation and reflection",
					"Learn to understand passages at multiple levels: immediate meaning, practical application, and deeper implications",
					"Establish regular prayer as essential spiritual nourishment and connection with the Divine",
					"Understand the eternal relationship between soul and body and its implications for daily life",
					"Comprehend the dual purpose of life: spiritual growth and contribution to societal transformation",
					"Foster meaningful consultation and group learning without reducing truth to mere opinion",
				],

				keyQuestions: [
					"How can the betterment of the world be accomplished through our daily actions?",
					'What does it mean to truly "converse with God" in prayer?',
					"How does understanding the eternal nature of the soul affect our relationships and service?",
					"What is the relationship between personal spiritual growth and contributing to society?",
					"How do we move beyond ritual and form to achieve genuine spiritual connection?",
					'What are the practical implications of walking "the path of service" in our daily lives?',
				],

				facilitationStyle: "analytical",
				suggestedDuration: 120, // 2 hours
				suggestedGroupSize: 5,

				creatorId: sampleUser.id,
				isPublished: true,
				publishedAt: new Date(),
			},
		});
	}

	console.log("Seed data created successfully:");
	console.log("- Sample User:", sampleUser.email);
	console.log("- Ruhi Lesson:", ruhiLesson.title);
}

main()
	.then(async () => {
		await prisma.$disconnect();
	})
	.catch(async (e) => {
		console.error(e);
		await prisma.$disconnect();
		process.exit(1);
	});
