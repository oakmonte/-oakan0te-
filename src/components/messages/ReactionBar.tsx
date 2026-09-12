import { Copy, Forward, MessageCircleReply, Plus, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { glassFloating } from "./glass";

const REACTIONS = ["❤️", "😂", "😮", "😢", "👏", "👍"];

export function ReactionBar({ onReact, onReply, onCopy, onClose }: { onReact: (emoji: string) => void; onReply: () => void; onCopy: () => void; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center bg-chat-overlay px-3 pb-[calc(env(safe-area-inset-bottom)+16px)]" onClick={onClose} role="presentation">
      <section className="w-full max-w-sm rounded-[22px] p-2" style={glassFloating} onClick={(event) => event.stopPropagation()} aria-label="Message actions">
        <div className="flex items-center justify-between px-1 py-1">
          {REACTIONS.map((emoji) => (
            <Button key={emoji} type="button" variant="ghost" size="icon" aria-label={`React ${emoji}`} onClick={() => onReact(emoji)} className="h-11 w-11 rounded-full text-[22px] active:scale-90">{emoji}</Button>
          ))}
          <Button type="button" variant="ghost" size="icon" aria-label="More reactions" className="h-11 w-11 rounded-full text-chat-text"><Plus /></Button>
        </div>
        <div className="mt-1 overflow-hidden rounded-[16px] bg-chat-elevated">
          <Button type="button" variant="ghost" onClick={onReply} className="h-12 w-full justify-start rounded-none text-chat-text"><MessageCircleReply /> Reply</Button>
          <Button type="button" variant="ghost" onClick={onCopy} className="h-12 w-full justify-start rounded-none border-t border-chat-border text-chat-text"><Copy /> Copy</Button>
          <Button type="button" variant="ghost" className="h-12 w-full justify-start rounded-none border-t border-chat-border text-chat-text"><Forward /> Forward</Button>
          <Button type="button" variant="ghost" className="h-12 w-full justify-start rounded-none border-t border-chat-border text-chat-danger"><ShieldAlert /> Report</Button>
        </div>
      </section>
    </div>
  );
}
