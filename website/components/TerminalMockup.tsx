'use client';

import { motion } from "framer-motion";

export function TerminalMockup() {
    return (
        <section className="py-24 container mx-auto px-4">
            <motion.div
                initial={{ opacity: 0, y: 40 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8 }}
                viewport={{ once: true }}
                className="max-w-4xl mx-auto"
            >
                <div className="terminal-mockup">
                    <div className="terminal-header">
                        <div className="flex gap-1.5">
                            <div className="w-3 h-3 rounded-full bg-[#ff5f56]" />
                            <div className="w-3 h-3 rounded-full bg-[#ffbd2e]" />
                            <div className="w-3 h-3 rounded-full bg-[#27c93f]" />
                        </div>
                        <div className="flex-1 text-center text-xs opacity-40 font-mono">ccam — bash</div>
                    </div>
                    <div className="terminal-body space-y-2 font-mono">
                        <div>
                            <span className="prompt">suenot@macbook:~/projects/ccam$</span>{" "}
                            <span className="command">claude</span>
                        </div>
                        <div className="output">&gt; Analyzing current directory...</div>
                        <div className="output">&gt; Found 12 files. Identifying optimization opportunities...</div>
                        <div className="output">&gt; 1. src/main.rs: Memory leak in PtyManager handle</div>
                        <div className="output">&gt; 2. src/db.rs: Missing index on session_id</div>
                        <div className="pt-2">
                            <span className="prompt">suenot@macbook:~/projects/ccam$</span>{" "}
                            <span className="command">fix issues</span>
                        </div>
                        <div className="output">&gt; Applying fixes... Done.</div>
                        <div className="text-[#f9e2af] pt-1">
                            ✓ Project is healthy. 142 tokens used ($0.002)
                        </div>
                    </div>
                </div>
            </motion.div>
        </section>
    );
}
