
import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GapFinder AI — AI-Powered Learning Diagnosis & Adaptive Revision",
  description:
    "Identify weak, medium, and strong curriculum topics from your syllabus and notes using grounded diagnostic quizzes and adaptive timetabling.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
