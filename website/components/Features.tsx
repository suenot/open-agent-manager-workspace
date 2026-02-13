'use client';

import { motion } from "framer-motion";
import { Layers, Smartphone, BarChart3, Terminal as TerminalIcon, FolderTree, Palette } from "lucide-react";

const features = [
    {
        icon: <Layers className="w-8 h-8" />,
        title: "Parallel Sessions",
        description: "Run 10+ Claude Code agents simultaneously with zero context switching. Tabbed interface and split-views included."
    },
    {
        icon: <Smartphone className="w-8 h-8" />,
        title: "Remote Control",
        description: "Integrated CMDOP support. Access your terminal, give prompts, and check status from your phone while on the go."
    },
    {
        icon: <BarChart3 className="w-8 h-8" />,
        title: "Token Metrics",
        description: "Real-time tracking of input/output tokens and cost per session. Stay within your budget with automatic limits."
    },
    {
        icon: <TerminalIcon className="w-8 h-8" />,
        title: "Native PTY",
        description: "Built with Rust and portable-pty. Real terminal emulation, not a headless wrapper. Full interactive support."
    },
    {
        icon: <FolderTree className="w-8 h-8" />,
        title: "Project Manager",
        description: "Sidebar with project tree, environment variables, and custom system prompts per project."
    },
    {
        icon: <Palette className="w-8 h-8" />,
        title: "Premium UI",
        description: "Designed for macOS. Glassmorphism, smooth animations, and a highly customizable dark theme."
    }
];

export function Features() {
    return (
        <section id="features" className="py-24 bg-background/50">
            <div className="container mx-auto px-4">
                <div className="text-center mb-16">
                    <h2 className="text-3xl md:text-5xl font-black mb-4">Power to your agents</h2>
                    <p className="text-muted-foreground text-lg max-w-2xl mx-auto">
                        Everything you need to scale your development workflow with Anthropic's Claude Code.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {features.map((feature, index) => (
                        <motion.div
                            key={index}
                            initial={{ opacity: 0, y: 20 }}
                            whileInView={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.5, delay: index * 0.1 }}
                            viewport={{ once: true }}
                            className="feature-card glass p-8 group hover:border-accent/50 transition-colors"
                        >
                            <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center mb-6 text-accent group-hover:scale-110 transition-transform">
                                {feature.icon}
                            </div>
                            <h3 className="text-xl font-bold mb-3">{feature.title}</h3>
                            <p className="text-muted-foreground leading-relaxed">
                                {feature.description}
                            </p>
                        </motion.div>
                    ))}
                </div>
            </div>
        </section>
    );
}
