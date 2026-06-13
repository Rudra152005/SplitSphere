"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Seeding database...');
    // Create users
    const passwordHash = await bcryptjs_1.default.hash('password123', 10);
    const user1 = await prisma.user.upsert({
        where: { email: 'alice@example.com' },
        update: {},
        create: {
            name: 'Alice Smith',
            email: 'alice@example.com',
            password: passwordHash,
        },
    });
    const user2 = await prisma.user.upsert({
        where: { email: 'bob@example.com' },
        update: {},
        create: {
            name: 'Bob Jones',
            email: 'bob@example.com',
            password: passwordHash,
        },
    });
    // Create a group
    const group = await prisma.group.create({
        data: {
            name: 'Trip to Hawaii',
            description: 'Shared expenses for our upcoming trip',
            members: {
                create: [
                    { userId: user1.id, role: 'ADMIN' },
                    { userId: user2.id, role: 'MEMBER' },
                ]
            }
        }
    });
    console.log('Seeding finished.');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
