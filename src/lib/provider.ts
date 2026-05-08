import { anthropic } from "@ai-sdk/anthropic";

const MODEL = "claude-haiku-4-5";

export class MockLanguageModel {
  readonly specificationVersion = "v2" as const;
  readonly provider = "mock";
  readonly modelId: string;
  readonly supportedUrls = {};

  constructor(modelId: string) {
    this.modelId = modelId;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  private extractUserPrompt(messages: any[]): string {
    for (let i = messages.length - 1; i >= 0; i--) {
      const msg = messages[i];
      if (msg.role === "user") {
        const c = msg.content;
        if (Array.isArray(c)) {
          return c.filter((p: any) => p.type === "text").map((p: any) => p.text).join(" ");
        }
        if (typeof c === "string") return c;
      }
    }
    return "";
  }

  private componentInfo(userPrompt: string): { type: string; name: string } {
    const lower = userPrompt.toLowerCase();
    if (lower.includes("form")) return { type: "form", name: "ContactForm" };
    if (lower.includes("pricing") || lower.includes("plan") || lower.includes("tier")) return { type: "pricing", name: "PricingSection" };
    if (lower.includes("card") || lower.includes("feature")) return { type: "card", name: "FeatureSection" };
    if (lower.includes("dashboard") || lower.includes("metric") || lower.includes("stat")) return { type: "dashboard", name: "Dashboard" };
    return { type: "counter", name: "Counter" };
  }

  private async *generateMockStream(messages: any[], userPrompt: string): AsyncGenerator<any> {
    yield { type: "stream-start", warnings: [] };

    const toolMessageCount = messages.filter((m: any) => m.role === "tool").length;
    const { type: componentType, name: componentName } = this.componentInfo(userPrompt);
    const textId = "text-1";

    const yieldText = async (self: this, text: string, delayMs: number): Promise<any[]> => {
      const parts: any[] = [{ type: "text-start", id: textId }];
      for (const char of text) {
        parts.push({ type: "text-delta", id: textId, delta: char });
        await self.delay(delayMs);
      }
      parts.push({ type: "text-end", id: textId });
      return parts;
    };

    if (toolMessageCount === 0) {
      const text = `This is a static response. Add an Anthropic API key in the .env file to use real generation. Let me create an App.jsx to display the component.`;
      yield { type: "text-start", id: textId };
      for (const char of text) {
        yield { type: "text-delta", id: textId, delta: char };
        await this.delay(15);
      }
      yield { type: "text-end", id: textId };
      yield {
        type: "tool-call",
        toolCallId: "call_3",
        toolName: "str_replace_editor",
        input: JSON.stringify({ command: "create", path: "/App.jsx", file_text: this.getAppCode(componentName) }),
      };
      yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 30 } };
      return;
    }

    if (toolMessageCount === 1) {
      const text = `I'll create a ${componentName} component for you.`;
      yield { type: "text-start", id: textId };
      for (const char of text) {
        yield { type: "text-delta", id: textId, delta: char };
        await this.delay(25);
      }
      yield { type: "text-end", id: textId };
      yield {
        type: "tool-call",
        toolCallId: "call_1",
        toolName: "str_replace_editor",
        input: JSON.stringify({ command: "create", path: `/components/${componentName}.jsx`, file_text: this.getComponentCode(componentType) }),
      };
      yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 30 } };
      return;
    }

    if (toolMessageCount === 2) {
      const text = `Now let me enhance the component with better styling.`;
      yield { type: "text-start", id: textId };
      for (const char of text) {
        yield { type: "text-delta", id: textId, delta: char };
        await this.delay(25);
      }
      yield { type: "text-end", id: textId };
      yield {
        type: "tool-call",
        toolCallId: "call_2",
        toolName: "str_replace_editor",
        input: JSON.stringify({ command: "str_replace", path: `/components/${componentName}.jsx`, old_str: this.getOldStringForReplace(componentType), new_str: this.getNewStringForReplace(componentType) }),
      };
      yield { type: "finish", finishReason: "tool-calls", usage: { inputTokens: 50, outputTokens: 30 } };
      return;
    }

    // Final summary
    const text = `Done! Created **${componentName}.jsx** and **App.jsx**. You can see the preview on the right.`;
    yield { type: "text-start", id: textId };
    for (const char of text) {
      yield { type: "text-delta", id: textId, delta: char };
      await this.delay(30);
    }
    yield { type: "text-end", id: textId };
    yield { type: "finish", finishReason: "stop", usage: { inputTokens: 50, outputTokens: 50 } };
  }

  private getComponentCode(componentType: string): string {
    switch (componentType) {
      case "pricing":
        return `import { useState } from 'react';
import { Check, Zap, Shield, Building2 } from 'lucide-react';

const plans = [
  {
    name: 'Free', price: 0, period: '/month',
    description: 'Perfect for individuals getting started',
    Icon: Zap, featured: false,
    features: ['Up to 5 projects', '1 GB storage', 'Basic analytics', 'Community support'],
    cta: 'Get started free',
  },
  {
    name: 'Pro', price: 19, period: '/month',
    description: 'For growing teams who need more power',
    Icon: Shield, featured: true,
    features: ['Unlimited projects', '50 GB storage', 'Advanced analytics', 'Priority support', 'Custom domains', 'API access'],
    cta: 'Start free trial',
  },
  {
    name: 'Enterprise', price: 99, period: '/month',
    description: 'For large organizations with custom needs',
    Icon: Building2, featured: false,
    features: ['Everything in Pro', 'Unlimited storage', 'Dedicated manager', 'SSO & SAML', 'Audit logs', 'SLA guarantee'],
    cta: 'Contact sales',
  },
];

export default function PricingSection() {
  const [yearly, setYearly] = useState(false);
  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-16 px-6">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">Pricing</span>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">Simple, transparent pricing</h2>
          <p className="text-lg text-gray-600 max-w-lg mx-auto mb-6">Start free. Scale as you grow. No hidden fees.</p>
          <div className="inline-flex items-center gap-1 bg-white border border-gray-200 rounded-full p-1 shadow-sm">
            <button onClick={() => setYearly(false)} className={\`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer \${!yearly ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}\`}>Monthly</button>
            <button onClick={() => setYearly(true)} className={\`px-4 py-1.5 rounded-full text-sm font-medium transition-all duration-200 cursor-pointer \${yearly ? 'bg-indigo-600 text-white shadow' : 'text-gray-600 hover:text-gray-900'}\`}>Yearly <span className="text-green-600 font-semibold">−20%</span></button>
          </div>
        </div>
        <div className="grid md:grid-cols-3 gap-6 items-start">
          {plans.map((plan) => (
            <div key={plan.name} className={\`relative rounded-2xl p-8 flex flex-col transition-all duration-200 hover:-translate-y-1 \${plan.featured ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-200 md:scale-105 md:-mt-2' : 'bg-white border border-gray-200 shadow-sm text-gray-900'}\`}>
              {plan.featured && <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 bg-gradient-to-r from-amber-400 to-orange-400 text-white text-xs font-bold px-4 py-1 rounded-full shadow">Most Popular</span>}
              <div className={\`w-10 h-10 rounded-xl flex items-center justify-center mb-5 \${plan.featured ? 'bg-white/20' : 'bg-indigo-50'}\`}>
                <plan.Icon size={20} className={plan.featured ? 'text-white' : 'text-indigo-600'} />
              </div>
              <h3 className="text-xl font-bold mb-1">{plan.name}</h3>
              <p className={\`text-sm mb-5 \${plan.featured ? 'text-indigo-100' : 'text-gray-500'}\`}>{plan.description}</p>
              <div className="flex items-baseline gap-1 mb-6">
                <span className="text-4xl font-bold">\${yearly && plan.price > 0 ? Math.round(plan.price * 0.8) : plan.price}</span>
                <span className={\`text-sm \${plan.featured ? 'text-indigo-200' : 'text-gray-500'}\`}>{plan.period}</span>
              </div>
              <ul className="space-y-3 mb-8 flex-1">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2.5 text-sm">
                    <Check size={15} className={\`flex-shrink-0 \${plan.featured ? 'text-indigo-200' : 'text-indigo-500'}\`} />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <button className={\`w-full py-3 rounded-xl font-semibold text-sm transition-all duration-200 active:scale-95 cursor-pointer focus-visible:ring-2 focus-visible:ring-offset-2 \${plan.featured ? 'bg-white text-indigo-600 hover:bg-indigo-50 focus-visible:ring-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 focus-visible:ring-indigo-500'}\`}>{plan.cta}</button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`;

      case "form":
        return `import { useState } from 'react';
import { User, Mail, MessageSquare, Send, CheckCircle } from 'lucide-react';

export default function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmitted(true);
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-6">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center max-w-md w-full">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle size={32} className="text-green-600" />
          </div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">Message sent!</h3>
          <p className="text-gray-500">Thanks for reaching out. We'll get back to you within 24 hours.</p>
          <button onClick={() => { setForm({ name: '', email: '', message: '' }); setSubmitted(false); }} className="mt-6 px-6 py-2.5 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors cursor-pointer">Send another</button>
        </div>
      </div>
    );
  }

  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-6 py-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Get in touch</h2>
          <p className="text-gray-500">Have a question or want to work together? We'd love to hear from you.</p>
        </div>
        <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Full name</label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="text" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required placeholder="Jane Smith" className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email address</label>
            <div className="relative">
              <Mail size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} required placeholder="jane@company.com" className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all" />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Message</label>
            <div className="relative">
              <MessageSquare size={16} className="absolute left-3 top-3 text-gray-400" />
              <textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} required rows={4} placeholder="Tell us what's on your mind..." className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all resize-none" />
            </div>
          </div>
          <button type="submit" className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-600 text-white py-3 rounded-xl font-semibold text-sm hover:opacity-90 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2">
            <Send size={16} />
            Send message
          </button>
        </form>
      </div>
    </section>
  );
}`;

      case "card":
        return `import { Zap, Shield, BarChart3, ArrowRight } from 'lucide-react';

const features = [
  {
    Icon: Zap,
    title: 'Lightning fast',
    description: 'Optimized for speed with sub-100ms response times and edge caching built in.',
    color: 'bg-amber-50 text-amber-600',
    featured: false,
  },
  {
    Icon: Shield,
    title: 'Enterprise security',
    description: 'SOC 2 Type II certified with end-to-end encryption and granular access controls.',
    color: 'bg-indigo-50 text-indigo-600',
    featured: true,
  },
  {
    Icon: BarChart3,
    title: 'Deep analytics',
    description: 'Real-time dashboards and custom reports that turn data into actionable insights.',
    color: 'bg-emerald-50 text-emerald-600',
    featured: false,
  },
];

export default function FeatureSection() {
  return (
    <section className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 py-16 px-6 flex flex-col justify-center">
      <div className="max-w-5xl mx-auto w-full">
        <div className="text-center mb-12">
          <span className="inline-block bg-indigo-100 text-indigo-700 text-sm font-semibold px-4 py-1.5 rounded-full mb-4">Features</span>
          <h2 className="text-4xl font-bold text-gray-900 mb-3">Everything you need to ship faster</h2>
          <p className="text-lg text-gray-600 max-w-xl mx-auto">A complete platform built for modern development teams. No duct tape required.</p>
        </div>
        <div className="grid md:grid-cols-3 gap-6">
          {features.map((f) => (
            <div key={f.title} className={\`rounded-2xl p-8 flex flex-col transition-all duration-200 hover:-translate-y-1 \${f.featured ? 'bg-gradient-to-br from-indigo-500 to-purple-600 text-white shadow-2xl shadow-indigo-200' : 'bg-white border border-gray-200 shadow-sm text-gray-900'}\`}>
              <div className={\`w-12 h-12 rounded-xl flex items-center justify-center mb-5 \${f.featured ? 'bg-white/20' : f.color}\`}>
                <f.Icon size={22} className={f.featured ? 'text-white' : ''} />
              </div>
              <h3 className="text-xl font-bold mb-2">{f.title}</h3>
              <p className={\`text-sm leading-relaxed flex-1 mb-6 \${f.featured ? 'text-indigo-100' : 'text-gray-500'}\`}>{f.description}</p>
              <button className={\`flex items-center gap-1.5 text-sm font-semibold transition-colors cursor-pointer \${f.featured ? 'text-white hover:text-indigo-100' : 'text-indigo-600 hover:text-indigo-800'}\`}>
                Learn more <ArrowRight size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}`;

      case "dashboard":
        return `import { TrendingUp, Users, ShoppingCart, DollarSign, ArrowUpRight, ArrowDownRight } from 'lucide-react';

const metrics = [
  { label: 'Total revenue', value: '$48,295', change: '+12.5%', up: true, Icon: DollarSign, color: 'bg-indigo-50 text-indigo-600' },
  { label: 'Active users', value: '3,842', change: '+8.1%', up: true, Icon: Users, color: 'bg-emerald-50 text-emerald-600' },
  { label: 'New orders', value: '1,293', change: '-2.4%', up: false, Icon: ShoppingCart, color: 'bg-amber-50 text-amber-600' },
  { label: 'Growth rate', value: '23.6%', change: '+4.2%', up: true, Icon: TrendingUp, color: 'bg-purple-50 text-purple-600' },
];

const recentOrders = [
  { id: '#4821', customer: 'Sarah Chen', product: 'Pro Plan', amount: '$19.00', status: 'Paid' },
  { id: '#4820', customer: 'Marcus Rivera', product: 'Enterprise Plan', amount: '$99.00', status: 'Paid' },
  { id: '#4819', customer: 'Aiko Tanaka', product: 'Pro Plan', amount: '$19.00', status: 'Pending' },
  { id: '#4818', customer: 'Liam O\'Brien', product: 'Free Plan', amount: '$0.00', status: 'Active' },
];

export default function Dashboard() {
  return (
    <div className="min-h-screen bg-gray-50 p-6 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-500 text-sm mt-1">Welcome back — here's what's happening today.</p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {metrics.map((m) => (
            <div key={m.label} className="bg-white rounded-2xl border border-gray-200 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <span className="text-sm text-gray-500">{m.label}</span>
                <div className={\`w-9 h-9 rounded-xl flex items-center justify-center \${m.color}\`}><m.Icon size={18} /></div>
              </div>
              <div className="text-2xl font-bold text-gray-900 mb-1">{m.value}</div>
              <div className={\`flex items-center gap-1 text-xs font-medium \${m.up ? 'text-emerald-600' : 'text-red-500'}\`}>
                {m.up ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}
                {m.change} vs last month
              </div>
            </div>
          ))}
        </div>
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-900 mb-4">Recent orders</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  {['Order', 'Customer', 'Product', 'Amount', 'Status'].map(h => (
                    <th key={h} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pb-3 pr-4">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {recentOrders.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 transition-colors">
                    <td className="py-3 pr-4 font-mono text-gray-500 text-xs">{o.id}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{o.customer}</td>
                    <td className="py-3 pr-4 text-gray-600">{o.product}</td>
                    <td className="py-3 pr-4 font-medium text-gray-900">{o.amount}</td>
                    <td className="py-3">
                      <span className={\`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium \${o.status === 'Paid' ? 'bg-emerald-100 text-emerald-700' : o.status === 'Pending' ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}\`}>{o.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}`;

      default:
        return `import { useState } from 'react';
import { Plus, Minus, RotateCcw } from 'lucide-react';

export default function Counter() {
  const [count, setCount] = useState(0);
  const isPositive = count > 0;
  const isNegative = count < 0;
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center px-6">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-10 flex flex-col items-center gap-6 w-full max-w-xs">
        <div className="text-center">
          <h2 className="text-xl font-bold text-gray-900 mb-1">Counter</h2>
          <p className="text-sm text-gray-500">Click the buttons to increment or decrement</p>
        </div>
        <div className={\`text-6xl font-bold tabular-nums transition-colors duration-200 \${isPositive ? 'text-indigo-600' : isNegative ? 'text-red-500' : 'text-gray-900'}\`}>{count}</div>
        <div className="flex items-center gap-3 w-full">
          <button onClick={() => setCount(c => c - 1)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-gray-200 text-gray-700 font-semibold text-sm hover:bg-gray-50 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Minus size={16} /> Dec
          </button>
          <button onClick={() => setCount(0)} className="p-2.5 rounded-xl border border-gray-200 text-gray-500 hover:bg-gray-50 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500" aria-label="Reset">
            <RotateCcw size={16} />
          </button>
          <button onClick={() => setCount(c => c + 1)} className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-indigo-600 text-white font-semibold text-sm hover:bg-indigo-700 active:scale-95 transition-all cursor-pointer focus-visible:ring-2 focus-visible:ring-indigo-500">
            <Plus size={16} /> Inc
          </button>
        </div>
      </div>
    </div>
  );
}`;
    }
  }

  private getOldStringForReplace(componentType: string): string {
    switch (componentType) {
      case "pricing": return "  const [yearly, setYearly] = useState(false);";
      case "form": return "  const [submitted, setSubmitted] = useState(false);";
      case "card": return "  return (";
      case "dashboard": return "  return (";
      default: return "  const [count, setCount] = useState(0);";
    }
  }

  private getNewStringForReplace(componentType: string): string {
    switch (componentType) {
      case "pricing": return "  const [yearly, setYearly] = useState(false);\n  // Billing toggle state";
      case "form": return "  const [submitted, setSubmitted] = useState(false);\n  // Tracks form submission";
      case "card": return "  // Feature section\n  return (";
      case "dashboard": return "  // Dashboard view\n  return (";
      default: return "  const [count, setCount] = useState(0);\n  // Counter state";
    }
  }

  private getAppCode(componentName: string): string {
    const fullPageComponents = ["PricingSection", "ContactForm", "FeatureSection", "Dashboard", "Counter"];
    if (fullPageComponents.includes(componentName)) {
      return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return <${componentName} />;
}`;
    }
    return `import ${componentName} from '@/components/${componentName}';

export default function App() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50 flex items-center justify-center p-8">
      <${componentName} />
    </div>
  );
}`;
  }

  async doGenerate(options: any): Promise<any> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const parts: any[] = [];
    for await (const part of this.generateMockStream(options.prompt, userPrompt)) {
      parts.push(part);
    }

    const textContent = parts
      .filter((p) => p.type === "text-delta")
      .map((p) => p.delta)
      .join("");

    const toolCalls = parts
      .filter((p) => p.type === "tool-call")
      .map((p) => ({ type: "tool-call" as const, toolCallId: p.toolCallId, toolName: p.toolName, input: p.input }));

    const finishPart = parts.find((p) => p.type === "finish") as any;

    return {
      content: [
        ...(textContent ? [{ type: "text" as const, text: textContent }] : []),
        ...toolCalls,
      ],
      finishReason: finishPart?.finishReason ?? "stop",
      usage: finishPart?.usage ?? { inputTokens: 100, outputTokens: 200 },
      warnings: [],
      request: {},
      response: { id: "mock", timestamp: new Date(), modelId: this.modelId },
    };
  }

  async doStream(options: any): Promise<any> {
    const userPrompt = this.extractUserPrompt(options.prompt);
    const self = this;

    const stream = new ReadableStream({
      async start(controller) {
        try {
          for await (const chunk of self.generateMockStream(options.prompt, userPrompt)) {
            controller.enqueue(chunk);
          }
          controller.close();
        } catch (error) {
          controller.error(error);
        }
      },
    });

    return {
      stream,
      warnings: [],
      request: {},
      rawResponse: { headers: {} },
    };
  }
}

export function getLanguageModel() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey.trim() === "") {
    console.log("No ANTHROPIC_API_KEY found, using mock provider");
    return new MockLanguageModel("mock-claude-haiku-4-5") as any;
  }
  return anthropic(MODEL);
}
