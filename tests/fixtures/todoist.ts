// Fake Todoist data shaped like the v1 API, for sync tests.
import type { TodoistSection, TodoistSource, TodoistTask } from '../../src/lib/server/todoist';

export const PROJECT_ID = '6hRR4gXPcqj5Jm3w';

export const sections: TodoistSection[] = [
	{ id: 's-kev', name: 'Kev Wishlist', project_id: PROJECT_ID },
	{ id: 's-casey', name: 'Casey Wishlist', project_id: PROJECT_ID },
	{ id: 's-robbie', name: 'Robbie Wishlist', project_id: PROJECT_ID },
	{ id: 's-logan', name: 'Logan Wishlist', project_id: PROJECT_ID },
	{ id: 's-house', name: 'House', project_id: PROJECT_ID }
];

function task(partial: Partial<TodoistTask> & { id: string; content: string }): TodoistTask {
	return {
		description: '',
		priority: 1,
		labels: [],
		section_id: null,
		project_id: PROJECT_ID,
		added_at: '2026-10-20T12:00:00Z',
		...partial
	};
}

export const tasks: TodoistTask[] = [
	task({
		id: 't-lego',
		content: 'LEGO Technic rally car',
		description:
			'The 42xxx one with the pull-back motor, not the small one.\nhttps://www.lego.com/en-us/product/rally-car-42077\nprice: 45\noccasion: holidays\nhttps://www.target.com/p/lego-rally/-/A-123',
		priority: 4,
		labels: ['toys'],
		section_id: 's-robbie'
	}),
	task({
		id: 't-towel',
		content: 'Hooded towel, shark',
		description: 'qty: 2\nPrice: $25',
		priority: 4,
		labels: ['clothes'],
		section_id: 's-robbie'
	}),
	task({
		id: 't-dogman',
		content: 'Dog Man: Big Jim Begins',
		description: 'price: 12',
		priority: 3,
		labels: ['books', 'bought'],
		section_id: 's-robbie'
	}),
	task({
		id: 't-secret',
		content: 'Surprise trip',
		labels: ['hidden'],
		section_id: 's-casey'
	}),
	task({
		id: 't-profile',
		content: 'Profile: Logan',
		description: 'Shoe size 2, loves blue',
		section_id: 's-logan'
	}),
	task({ id: 't-socks', content: 'Running socks (3-pack)', priority: 2, section_id: 's-kev' }),
	task({ id: 't-paint', content: 'Paint the fence', section_id: 's-house' }),
	task({ id: 't-nosection', content: 'Lightbulbs', section_id: null })
];

export function fakeSource(
	overrides: Partial<{ sections: TodoistSection[]; tasks: TodoistTask[] }> = {}
): TodoistSource {
	const s = overrides.sections ?? sections;
	const t = overrides.tasks ?? tasks;
	return {
		async findProjectIdByName(name) {
			return name === 'Purchases' ? PROJECT_ID : null;
		},
		async listSections(projectId) {
			return projectId === PROJECT_ID ? s : [];
		},
		async listTasks(projectId) {
			return projectId === PROJECT_ID ? t : [];
		}
	};
}
