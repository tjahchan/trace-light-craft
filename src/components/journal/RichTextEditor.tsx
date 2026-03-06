import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import { useEffect } from "react";
import {
  Bold,
  Italic,
  List,
  ListOrdered,
  Heading,
  Highlighter,
  MessageSquareQuote,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  className?: string;
}

export function RichTextEditor({ content, onChange, placeholder = "Start writing...", className }: RichTextEditorProps) {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: { levels: [2, 3] },
        blockquote: {},
        bulletList: {},
        orderedList: {},
      }),
      Highlight,
      Placeholder.configure({ placeholder }),
    ],
    content,
    onUpdate: ({ editor }) => {
      onChange(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: "prose prose-invert prose-sm max-w-none min-h-[180px] focus:outline-none text-foreground/90 leading-relaxed",
      },
    },
  });

  // Sync external content changes (e.g. switching entries)
  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      editor.commands.setContent(content || "");
    }
  }, [content, editor]);

  if (!editor) return null;

  const tools = [
    { icon: Bold, action: () => editor.chain().focus().toggleBold().run(), active: editor.isActive("bold") },
    { icon: Italic, action: () => editor.chain().focus().toggleItalic().run(), active: editor.isActive("italic") },
    { icon: List, action: () => editor.chain().focus().toggleBulletList().run(), active: editor.isActive("bulletList") },
    { icon: ListOrdered, action: () => editor.chain().focus().toggleOrderedList().run(), active: editor.isActive("orderedList") },
    { icon: Heading, action: () => editor.chain().focus().toggleHeading({ level: 2 }).run(), active: editor.isActive("heading", { level: 2 }) },
    { icon: Highlighter, action: () => editor.chain().focus().toggleHighlight().run(), active: editor.isActive("highlight") },
    { icon: MessageSquareQuote, action: () => editor.chain().focus().toggleBlockquote().run(), active: editor.isActive("blockquote") },
  ];

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-center gap-1">
        {tools.map(({ icon: Icon, action, active }, i) => (
          <Button
            key={i}
            variant="ghost"
            size="icon"
            type="button"
            onClick={action}
            className={cn(
              "h-7 w-7 text-muted-foreground hover:text-foreground transition-colors",
              active && "bg-white/[0.08] text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
          </Button>
        ))}
      </div>
      <EditorContent editor={editor} />
    </div>
  );
}
