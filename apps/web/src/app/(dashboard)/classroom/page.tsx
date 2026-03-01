"use client";

import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ClassroomTypeBadge } from "@/components/classroom/classroom-type-badge";
import { Plus, BookOpen } from "lucide-react";
import { UserRole, ClassroomType } from "@langopia/shared/types";

interface ClassroomData {
  id: string;
  name: string;
  description: string | null;
  type: ClassroomType;
  languageTarget: string;
  maxStudents: number;
  teacher?: { name: string };
  createdAt: string;
}

export default function ClassroomListPage() {
  const { data: session } = useSession();
  const [classrooms, setClassrooms] = useState<ClassroomData[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);

  const role = session?.user?.role as UserRole | undefined;
  const canCreate = role === UserRole.TEACHER || role === UserRole.ADMIN;

  useEffect(() => {
    fetch("/api/classrooms")
      .then((res) => res.json())
      .then(setClassrooms)
      .finally(() => setLoading(false));
  }, []);

  async function handleCreate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/classrooms", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: form.get("name"),
        description: form.get("description") || null,
        type: form.get("type"),
        languageTarget: form.get("languageTarget"),
        maxStudents: Number(form.get("maxStudents")) || 1,
      }),
    });

    if (res.ok) {
      const created = await res.json();
      setClassrooms((prev) => [created, ...prev]);
      setDialogOpen(false);
    }
  }

  if (loading) {
    return <div className="text-muted-foreground">Loading classrooms...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Classrooms</h1>
          <p className="text-muted-foreground">
            {canCreate ? "Manage your classrooms and sessions" : "Your enrolled classes"}
          </p>
        </div>
        {canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Create Classroom
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Classroom</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleCreate} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" name="name" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="description">Description</Label>
                  <Textarea id="description" name="description" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="type">Type</Label>
                  <Select name="type" defaultValue={ClassroomType.ONE_TO_ONE}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={ClassroomType.ONE_TO_ONE}>1:1</SelectItem>
                      <SelectItem value={ClassroomType.GROUP}>Group</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="languageTarget">Language</Label>
                  <Input id="languageTarget" name="languageTarget" placeholder="e.g. English" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="maxStudents">Max Students</Label>
                  <Input id="maxStudents" name="maxStudents" type="number" min={1} defaultValue={1} />
                </div>
                <Button type="submit" className="w-full">Create</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {classrooms.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <BookOpen className="mb-4 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">
              {canCreate ? "No classrooms yet. Create your first one!" : "You are not enrolled in any classes yet."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {classrooms.map((classroom) => (
            <Link key={classroom.id} href={`/classroom/${classroom.id}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <CardTitle className="text-lg">{classroom.name}</CardTitle>
                    <ClassroomTypeBadge type={classroom.type} />
                  </div>
                  {classroom.description && (
                    <CardDescription className="line-clamp-2">
                      {classroom.description}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{classroom.languageTarget}</span>
                    <span>Max {classroom.maxStudents} students</span>
                  </div>
                  {classroom.teacher && (
                    <p className="mt-1 text-sm text-muted-foreground">
                      Teacher: {classroom.teacher.name}
                    </p>
                  )}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
