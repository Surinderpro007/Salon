import { ListingStatus, PrismaClient, Role, VerificationStatus } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.notification.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.barberService.deleteMany();
  await prisma.service.deleteMany();
  await prisma.barber.deleteMany();
  await prisma.salon.deleteMany();
  await prisma.user.deleteMany();

  const adminPassword = await bcrypt.hash("admin123", 12);
  const ownerPassword = await bcrypt.hash("owner123", 12);
  const customerPassword = await bcrypt.hash("customer123", 12);

  const admin = await prisma.user.create({
    data: {
      name: "Super Admin",
      email: "admin@salon.com",
      password: adminPassword,
      phone: "9999999999",
      role: Role.SUPER_ADMIN,
    },
  });

  const owner = await prisma.user.create({
    data: {
      name: "Rajesh Kapoor",
      email: "owner@salon.com",
      password: ownerPassword,
      phone: "9888877777",
      role: Role.SALON_OWNER,
    },
  });

  const customer = await prisma.user.create({
    data: {
      name: "Priya Sharma",
      email: "customer@example.com",
      password: customerPassword,
      phone: "9876543210",
      role: Role.CUSTOMER,
    },
  });

  const salon = await prisma.salon.create({
    data: {
      ownerId: owner.id,
      name: "Royal Hair Salon",
      description:
        "Premium unisex salon offering cuts, color, beard styling and spa treatments.",
      logo: "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=400&h=400&fit=crop",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1560066984-138dadb4c035?w=800&h=500&fit=crop",
        "https://images.unsplash.com/photo-1521590832167-7bcbfaa6381f?w=800&h=500&fit=crop",
        "https://images.unsplash.com/photo-1599351431202-1e0f0137899a?w=800&h=500&fit=crop",
      ]),
      address: "42 MG Road, Near City Mall",
      city: "Mumbai",
      contactNumber: "022-45678901",
      openingTime: "10:00",
      closingTime: "19:00",
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
      status: "ACTIVE",
      listingStatus: ListingStatus.APPROVED,
      verificationStatus: VerificationStatus.VERIFIED,
      verifiedAt: new Date(),
      isPremium: true,
      reviewedAt: new Date(),
      submittedAt: new Date(),
      rating: 4.7,
      category: "Unisex",
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      name: "Neha Verma",
      email: "owner2@salon.com",
      password: ownerPassword,
      phone: "9777766666",
      role: Role.SALON_OWNER,
    },
  });

  // Pending approval example
  await prisma.salon.create({
    data: {
      ownerId: owner2.id,
      name: "Glow Studio",
      description: "Boutique styling studio awaiting platform approval.",
      logo: "https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=400&h=400&fit=crop",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1562322140-8baeececf3df?w=800&h=500&fit=crop",
      ]),
      address: "7 Lake View Road",
      city: "Pune",
      contactNumber: "020-12345678",
      openingTime: "10:00",
      closingTime: "20:00",
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
      status: "ACTIVE",
      listingStatus: ListingStatus.PENDING_APPROVAL,
      submittedAt: new Date(),
      rating: 0,
      category: "Women",
      barbers: {
        create: {
          name: "Sana",
          specialization: "Styling",
          yearsExperience: 4,
          workStartTime: "10:00",
          workEndTime: "20:00",
        },
      },
      services: {
        create: {
          name: "Blow Dry",
          description: "Professional blow dry",
          price: 350,
          duration: 40,
        },
      },
    },
  });

  const salon2 = await prisma.salon.create({
    data: {
      ownerId: owner.id,
      name: "Style Studio Barbers",
      description: "Classic barbershop for modern gentlemen.",
      logo: "https://images.unsplash.com/photo-1503951914875-452162b0f3f1?w=400&h=400&fit=crop",
      images: JSON.stringify([
        "https://images.unsplash.com/photo-1622286342621-4bd786c2447c?w=800&h=500&fit=crop",
        "https://images.unsplash.com/photo-1621605815971-fbc98d665033?w=800&h=500&fit=crop",
      ]),
      address: "18 Park Street",
      city: "Delhi",
      contactNumber: "011-23456789",
      openingTime: "09:00",
      closingTime: "20:00",
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
      status: "ACTIVE",
      listingStatus: ListingStatus.APPROVED,
      reviewedAt: new Date(),
      submittedAt: new Date(),
      rating: 4.4,
      category: "Men",
    },
  });

  const services = await Promise.all([
    prisma.service.create({
      data: {
        salonId: salon.id,
        name: "Haircut",
        description: "Classic haircut with wash and style",
        price: 200,
        duration: 30,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        name: "Beard",
        description: "Beard trim and shaping",
        price: 100,
        duration: 20,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        name: "Haircut + Beard",
        description: "Complete grooming package",
        price: 250,
        duration: 45,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        name: "Hair Color",
        description: "Professional hair coloring",
        price: 800,
        duration: 90,
      },
    }),
    prisma.service.create({
      data: {
        salonId: salon.id,
        name: "Hair Spa",
        description: "Relaxing hair spa treatment",
        price: 600,
        duration: 60,
      },
    }),
  ]);

  const [haircut, beard, combo, color, spa] = services;

  const rahul = await prisma.barber.create({
    data: {
      salonId: salon.id,
      name: "Rahul",
      profilePhoto:
        "https://images.unsplash.com/photo-1560250097-0b93528c311a?w=300&h=300&fit=crop",
      bio: "Expert haircut specialist with a keen eye for modern styles.",
      yearsExperience: 5,
      specialization: "Haircut Specialist",
      skills: JSON.stringify(["Fade", "Pompadour", "Kids Cut"]),
      rating: 4.8,
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
      workStartTime: "10:00",
      workEndTime: "19:00",
      breakStartTime: "13:00",
      breakEndTime: "14:00",
    },
  });

  const amit = await prisma.barber.create({
    data: {
      salonId: salon.id,
      name: "Amit",
      profilePhoto:
        "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop",
      bio: "Beard & styling specialist known for precise detailing.",
      yearsExperience: 3,
      specialization: "Beard & Styling Specialist",
      skills: JSON.stringify(["Beard Design", "Hot Towel", "Styling"]),
      rating: 4.6,
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat"]),
      workStartTime: "10:00",
      workEndTime: "19:00",
    },
  });

  const vikas = await prisma.barber.create({
    data: {
      salonId: salon.id,
      name: "Vikas",
      profilePhoto:
        "https://images.unsplash.com/photo-1519085360753-af0119f7cbe7?w=300&h=300&fit=crop",
      bio: "Hair color specialist with advanced coloring techniques.",
      yearsExperience: 7,
      specialization: "Hair Color Specialist",
      skills: JSON.stringify(["Balayage", "Highlights", "Global Color"]),
      rating: 4.9,
      workingDays: JSON.stringify(["Tue", "Wed", "Thu", "Fri", "Sat"]),
      workStartTime: "11:00",
      workEndTime: "19:00",
    },
  });

  await prisma.barberService.createMany({
    data: [
      { barberId: rahul.id, serviceId: haircut.id },
      { barberId: rahul.id, serviceId: beard.id },
      { barberId: rahul.id, serviceId: combo.id },
      { barberId: amit.id, serviceId: haircut.id },
      { barberId: amit.id, serviceId: beard.id },
      { barberId: amit.id, serviceId: combo.id },
      { barberId: vikas.id, serviceId: color.id },
      { barberId: vikas.id, serviceId: spa.id },
      { barberId: vikas.id, serviceId: haircut.id },
    ],
  });

  const s2cut = await prisma.service.create({
    data: {
      salonId: salon2.id,
      name: "Classic Cut",
      description: "Traditional barber cut",
      price: 180,
      duration: 30,
    },
  });

  const s2barber = await prisma.barber.create({
    data: {
      salonId: salon2.id,
      name: "Arjun",
      profilePhoto:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&h=300&fit=crop",
      bio: "Classic barber with modern techniques.",
      yearsExperience: 6,
      specialization: "Classic Cuts",
      skills: JSON.stringify(["Scissor Cut", "Clipper"]),
      rating: 4.5,
      workingDays: JSON.stringify(["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]),
      workStartTime: "09:00",
      workEndTime: "20:00",
    },
  });

  await prisma.barberService.create({
    data: { barberId: s2barber.id, serviceId: s2cut.id },
  });

  console.log("Seed complete!");
  console.log("Super Admin:  admin@salon.com / admin123");
  console.log("Salon Owner:  owner@salon.com / owner123");
  console.log("Customer:     customer@example.com / customer123");
  console.log(`Admin=${admin.id} Owner=${owner.id} Customer=${customer.id}`);
  console.log(`Approved salon: ${salon.name}`);
  console.log("Pending listing: Glow Studio (owner2@salon.com)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
