import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getDataSource } from "@/lib/database";
import { User } from "@/entities";
import { UserRole } from "@langopia/shared/types";

export async function POST(req: NextRequest) {
  try {
    const { name, email, password } = await req.json();

    if (!name || !email || !password) {
      return NextResponse.json(
        { error: "Name, email, and password are required" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters" },
        { status: 400 }
      );
    }

    const ds = await getDataSource();
    const userRepo = ds.getRepository(User);

    const existingUser = await userRepo.findOne({ where: { email } });
    if (existingUser) {
      return NextResponse.json(
        { error: "A user with this email already exists" },
        { status: 409 }
      );
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = userRepo.create({
      name,
      email,
      passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    });

    await userRepo.save(user);

    return NextResponse.json(
      { message: "Account created successfully" },
      { status: 201 }
    );
  } catch (error) {
    console.error("Registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
