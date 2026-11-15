import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  const passwordHash = await bcrypt.hash('Passw0rd!', 10);

  // 1. Seed Users
  const admin = await prisma.user.upsert({
    where: { email: 'admin@demo.com' },
    update: { passwordHash, active: true, role: 'ADMIN', name: 'Admin User' },
    create: {
      email: 'admin@demo.com',
      name: 'Admin User',
      passwordHash,
      role: 'ADMIN',
      active: true,
    },
  });

  const manager = await prisma.user.upsert({
    where: { email: 'manager@demo.com' },
    update: { passwordHash, active: true, role: 'MANAGER', name: 'Manager User' },
    create: {
      email: 'manager@demo.com',
      name: 'Manager User',
      passwordHash,
      role: 'MANAGER',
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'approver@demo.com' },
    update: { passwordHash, active: true, role: 'APPROVER', name: 'Approver User' },
    create: {
      email: 'approver@demo.com',
      name: 'Approver User',
      passwordHash,
      role: 'APPROVER',
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'alice@demo.com' },
    update: { passwordHash, active: true, role: 'REQUESTER', name: 'Alice Requester', managerId: manager.id },
    create: {
      email: 'alice@demo.com',
      name: 'Alice Requester',
      passwordHash,
      role: 'REQUESTER',
      managerId: manager.id,
      active: true,
    },
  });

  await prisma.user.upsert({
    where: { email: 'bob@demo.com' },
    update: { passwordHash, active: true, role: 'REQUESTER', name: 'Bob Requester', managerId: manager.id },
    create: {
      email: 'bob@demo.com',
      name: 'Bob Requester',
      passwordHash,
      role: 'REQUESTER',
      managerId: manager.id,
      active: true,
    },
  });

  console.log('✅ Seeded users (admin, manager, approver, alice, bob)');

  // 2. Seed Request Types

  // LEAVE
  const leaveFormSchema = [
    {
      name: 'leaveType',
      label: 'Leave Type',
      type: 'select',
      required: true,
      options: ['Annual', 'Sick', 'Unpaid'],
    },
    {
      name: 'startDate',
      label: 'Start Date',
      type: 'date',
      required: true,
    },
    {
      name: 'endDate',
      label: 'End Date',
      type: 'date',
      required: true,
    },
    {
      name: 'reason',
      label: 'Reason for Leave',
      type: 'textarea',
      required: true,
      placeholder: 'Explain the reason for leave...',
    },
  ];

  const leaveType = await prisma.requestType.upsert({
    where: { key: 'LEAVE' },
    update: {
      name: 'Leave Request',
      description: 'Request annual, sick, or unpaid time off',
      formSchema: JSON.stringify(leaveFormSchema),
      active: true,
    },
    create: {
      key: 'LEAVE',
      name: 'Leave Request',
      description: 'Request annual, sick, or unpaid time off',
      formSchema: JSON.stringify(leaveFormSchema),
      active: true,
    },
  });

  // Re-create steps for LEAVE
  await prisma.workflowStep.deleteMany({ where: { requestTypeId: leaveType.id } });
  await prisma.workflowStep.createMany({
    data: [
      {
        requestTypeId: leaveType.id,
        order: 1,
        name: 'Manager Approval',
        approverKind: 'REQUESTER_MANAGER',
      },
      {
        requestTypeId: leaveType.id,
        order: 2,
        name: 'HR Approval',
        approverKind: 'ROLE',
        approverRole: 'APPROVER',
        condition: JSON.stringify({ field: 'leaveType', op: 'eq', value: 'Unpaid' }),
      },
    ],
  });

  // PURCHASE
  const purchaseFormSchema = [
    {
      name: 'item',
      label: 'Item / Service Description',
      type: 'text',
      required: true,
      placeholder: 'e.g. Ergonomic chair, Cloud server subscription',
    },
    {
      name: 'vendor',
      label: 'Vendor / Supplier',
      type: 'text',
      required: true,
      placeholder: 'e.g. Amazon, Google Cloud',
    },
    {
      name: 'amount',
      label: 'Amount ($)',
      type: 'number',
      required: true,
      min: 1,
      placeholder: 'Total estimated cost in USD',
    },
    {
      name: 'justification',
      label: 'Business Justification',
      type: 'textarea',
      required: true,
      placeholder: 'Why is this purchase necessary for team productivity?',
    },
  ];

  const purchaseType = await prisma.requestType.upsert({
    where: { key: 'PURCHASE' },
    update: {
      name: 'Purchase Request',
      description: 'Request equipment, software licenses, or office supplies',
      formSchema: JSON.stringify(purchaseFormSchema),
      active: true,
    },
    create: {
      key: 'PURCHASE',
      name: 'Purchase Request',
      description: 'Request equipment, software licenses, or office supplies',
      formSchema: JSON.stringify(purchaseFormSchema),
      active: true,
    },
  });

  await prisma.workflowStep.deleteMany({ where: { requestTypeId: purchaseType.id } });
  await prisma.workflowStep.createMany({
    data: [
      {
        requestTypeId: purchaseType.id,
        order: 1,
        name: 'Manager Approval',
        approverKind: 'REQUESTER_MANAGER',
      },
      {
        requestTypeId: purchaseType.id,
        order: 2,
        name: 'Finance Approval',
        approverKind: 'ROLE',
        approverRole: 'APPROVER',
        condition: JSON.stringify({ field: 'amount', op: 'gte', value: 1000 }),
      },
    ],
  });

  // CONTENT_PUBLISH
  const contentFormSchema = [
    {
      name: 'contentTitle',
      label: 'Content Title',
      type: 'text',
      required: true,
      placeholder: 'Title of the article or announcement',
    },
    {
      name: 'channel',
      label: 'Publish Channel',
      type: 'select',
      required: true,
      options: ['Blog', 'Social', 'Newsletter', 'Website'],
    },
    {
      name: 'contentUrl',
      label: 'Content URL / Draft Link',
      type: 'text',
      required: true,
      placeholder: 'https://docs.google.com/...',
    },
    {
      name: 'publishDate',
      label: 'Target Publication Date',
      type: 'date',
      required: true,
    },
    {
      name: 'summary',
      label: 'Summary / Key Highlights',
      type: 'textarea',
      required: true,
      placeholder: 'Brief summary of the publication...',
    },
  ];

  const contentType = await prisma.requestType.upsert({
    where: { key: 'CONTENT_PUBLISH' },
    update: {
      name: 'Content Publication',
      description: 'Review and publication sign-off for blogs, articles, and releases',
      formSchema: JSON.stringify(contentFormSchema),
      active: true,
    },
    create: {
      key: 'CONTENT_PUBLISH',
      name: 'Content Publication',
      description: 'Review and publication sign-off for blogs, articles, and releases',
      formSchema: JSON.stringify(contentFormSchema),
      active: true,
    },
  });

  await prisma.workflowStep.deleteMany({ where: { requestTypeId: contentType.id } });
  await prisma.workflowStep.createMany({
    data: [
      {
        requestTypeId: contentType.id,
        order: 1,
        name: 'Editor Review',
        approverKind: 'ROLE',
        approverRole: 'APPROVER',
      },
      {
        requestTypeId: contentType.id,
        order: 2,
        name: 'Manager Sign-off',
        approverKind: 'ROLE',
        approverRole: 'MANAGER',
      },
    ],
  });

  console.log('✅ Seeded request types (LEAVE, PURCHASE, CONTENT_PUBLISH)');
  console.log('✨ Seeding complete.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

