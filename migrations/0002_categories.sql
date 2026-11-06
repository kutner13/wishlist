-- Subtasks: a Todoist parent task with active children is a group, not a wish (README "Categories").
ALTER TABLE items ADD COLUMN parent_todoist_task_id TEXT;
CREATE INDEX items_parent ON items(parent_todoist_task_id);
