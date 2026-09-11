export type Field = {
  key: string;
  type?: string;
  options?: string[];
  source?: string;
  optional?: boolean;
};
export const fields: Record<string, Field[]> = {
  tickets: [
    { key: "title" },
    { key: "description", type: "textarea" },
    { key: "category", options: ["support", "software", "hardware", "onsite"] },
    { key: "priority", options: ["normal", "low", "high", "urgent"] },
  ],
  leads: [
    { key: "title" },
    { key: "email", type: "email" },
    { key: "service", options: ["software", "support", "hardware", "onsite"] },
    { key: "description", type: "textarea", optional: true },
  ],
  interactions: [
    { key: "title" },
    { key: "leadId", source: "leads" },
    { key: "ticketId", source: "tickets", optional: true },
    { key: "type", options: ["call", "email", "meeting", "ticket"] },
    { key: "description", type: "textarea" },
  ],
  projects: [
    { key: "title" },
    { key: "customerId", source: "customers" },
    { key: "assigneeId", source: "staff", optional: true },
    { key: "dueDate", type: "date" },
    { key: "ticketId", source: "tickets", optional: true },
    { key: "description", type: "textarea", optional: true },
  ],
  tasks: [
    { key: "title" },
    { key: "projectId", source: "projects" },
    { key: "assigneeId", source: "staff", optional: true },
    { key: "dueDate", type: "date" },
  ],
  time: [
    { key: "title" },
    { key: "type", options: ["work", "late", "leave", "sick", "overtime"] },
    { key: "projectId", source: "projects", optional: true },
    { key: "ticketId", source: "tickets", optional: true },
  ],
  invoices: [
    { key: "title" },
    { key: "customerId", source: "customers" },
    { key: "service", options: ["software", "support", "hardware", "onsite"] },
    { key: "amount", type: "number" },
    { key: "currency", options: ["COP", "USD", "EUR", "GBP"] },
    { key: "dueDate", type: "date" },
    { key: "projectId", source: "projects", optional: true },
    { key: "ticketId", source: "tickets", optional: true },
  ],
  ledger: [
    { key: "title" },
    { key: "type", options: ["expense", "income"] },
    { key: "amount", type: "number" },
    { key: "currency", options: ["COP", "USD", "EUR", "GBP"] },
    { key: "date", type: "date" },
    { key: "service", options: ["software", "support", "hardware", "onsite"] },
    { key: "customerId", source: "customers", optional: true },
  ],
  employees: [
    { key: "name" },
    { key: "email", type: "email" },
    { key: "password", type: "password" },
    { key: "role", options: ["EMPLOYEE", "ADMIN", "CUSTOMER"] },
  ],
};
export const statuses: Record<string, string[]> = {
  tickets: ["open", "in_progress", "resolved", "closed"],
  leads: ["contact", "proposal", "closing", "won", "lost"],
  projects: ["pending", "in_progress", "completed"],
  tasks: ["pending", "in_progress", "completed"],
};
