import React, { useState } from "react";
import { FileText, ArrowLeft, Shield, Scale, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";

export default function Eula() {
  const [viewMode, setViewMode] = useState<"summary" | "verbatim" | "both">("both");

  const summaryCards = [
    {
      title: "1. Proprietary Software",
      desc: "This software is strictly proprietary. You are granted a limited license to use it, but you do not own it. We retain all rights, title, and interest in the software and any accompanying materials.",
    },
    {
      title: "2. Usage Restrictions",
      desc: "You may not copy, modify, distribute, sell, lease, reverse engineer, or attempt to extract the source code of this software or any of its components, including our AI models and underlying infrastructure.",
    },
    {
      title: "3. No Warranties",
      desc: "This software is provided 'as is' without any warranties of any kind, either express or implied. We do not guarantee that the software will be error-free or uninterrupted.",
    },
    {
      title: "4. Limitation of Liability",
      desc: "In no event shall we be liable for any direct, indirect, incidental, special, or consequential damages arising out of the use or inability to use the software, even if we have been advised of the possibility of such damages.",
    },
    {
      title: "5. Termination",
      desc: "We reserve the right to terminate your license and access to the software at any time, with or without cause, and without notice.",
    },
    {
      title: "6. Updates and Changes",
      desc: "We may update, modify, or discontinue the software or any of its features at any time without prior notice. This agreement applies to all updates and modifications.",
    }
  ];

  return (
    <div className="min-h-screen bg-zinc-950 text-white font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-zinc-950/80 backdrop-blur-md border-b border-white/10">
        <div className="max-w-5xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/" className="p-2 hover:bg-white/5 rounded-full transition-colors group">
              <ArrowLeft className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
            </Link>
            <div>
              <h1 className="text-xl font-bold flex items-center gap-2">
                <FileText className="w-5 h-5 text-emerald-500" />
                End User License Agreement (EULA)
              </h1>
              <p className="text-xs text-zinc-400">Proprietary Software License</p>
            </div>
          </div>

          <div className="flex bg-white/5 rounded-lg p-1">
            <button
              onClick={() => setViewMode("summary")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === "summary" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white"}`}
            >
              Summary
            </button>
            <button
              onClick={() => setViewMode("verbatim")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === "verbatim" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white"}`}
            >
              Verbatim
            </button>
            <button
              onClick={() => setViewMode("both")}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${viewMode === "both" ? "bg-emerald-500/20 text-emerald-400" : "text-zinc-400 hover:text-white"}`}
            >
              Both
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-12 space-y-16">

        {/* Intro */}
        <div className="prose prose-invert max-w-none text-zinc-400">
          <p className="lead text-xl text-zinc-300">
            This End User License Agreement ("EULA") is a binding legal agreement between you and the software provider. By accessing, installing, or using the software, you agree to be bound by the terms of this EULA. If you do not agree, do not use the software.
          </p>
          <p className="text-sm">Last Updated: {new Date().toLocaleDateString()}</p>
        </div>

        {/* Summary Section */}
        {(viewMode === "summary" || viewMode === "both") && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Sparkles className="w-6 h-6 text-emerald-500" />
              <h2 className="text-2xl font-bold">Plain English Summary</h2>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              {summaryCards.map((card, idx) => (
                <div key={idx} className="bg-white/5 border border-white/10 p-6 rounded-2xl hover:bg-white/10 transition-colors">
                  <h3 className="text-lg font-bold text-white mb-2">{card.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed">{card.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Verbatim Legal Text */}
        {(viewMode === "verbatim" || viewMode === "both") && (
          <section className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500 delay-100">
             <div className="flex items-center gap-3 border-b border-white/10 pb-4">
              <Scale className="w-6 h-6 text-zinc-400" />
              <h2 className="text-2xl font-bold">Verbatim Legal Agreement</h2>
            </div>

            <div className="bg-zinc-900 border border-white/10 p-8 rounded-2xl space-y-8 text-sm text-zinc-300 leading-relaxed font-mono">
              <div>
                <h3 className="text-white font-bold mb-2">1. GRANT OF LICENSE</h3>
                <p>Subject to the terms and conditions of this Agreement, the provider grants you a personal, non-exclusive, non-transferable, limited license to use the software solely for your internal business purposes. You may not distribute, sublicense, or otherwise transfer the software to any third party.</p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">2. PROPRIETARY RIGHTS</h3>
                <p>The software is licensed, not sold. All right, title, and interest in and to the software, including any intellectual property rights therein, remain exclusively with the provider. The software is protected by copyright laws and international copyright treaties, as well as other intellectual property laws and treaties.</p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">3. RESTRICTIONS ON USE</h3>
                <p>You agree not to, and you will not permit others to: a) license, sell, rent, lease, assign, distribute, transmit, host, outsource, disclose or otherwise commercially exploit the software; b) modify, make derivative works of, disassemble, decrypt, reverse compile or reverse engineer any part of the software; c) remove, alter or obscure any proprietary notice (including any notice of copyright or trademark) of the provider or its affiliates, partners, suppliers or the licensors of the software.</p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">4. DISCLAIMER OF WARRANTIES</h3>
                <p>THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.</p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">5. LIMITATION OF LIABILITY</h3>
                <p>TO THE MAXIMUM EXTENT PERMITTED BY APPLICABLE LAW, IN NO EVENT SHALL THE PROVIDER OR ITS SUPPLIERS BE LIABLE FOR ANY SPECIAL, INCIDENTAL, INDIRECT, OR CONSEQUENTIAL DAMAGES WHATSOEVER (INCLUDING, BUT NOT LIMITED TO, DAMAGES FOR LOSS OF PROFITS, LOSS OF DATA OR OTHER INFORMATION, FOR BUSINESS INTERRUPTION, FOR PERSONAL INJURY, FOR LOSS OF PRIVACY ARISING OUT OF OR IN ANY WAY RELATED TO THE USE OF OR INABILITY TO USE THE SOFTWARE, THIRD-PARTY SOFTWARE AND/OR THIRD-PARTY HARDWARE USED WITH THE SOFTWARE, OR OTHERWISE IN CONNECTION WITH ANY PROVISION OF THIS AGREEMENT), EVEN IF THE PROVIDER OR ANY SUPPLIER HAS BEEN ADVISED OF THE POSSIBILITY OF SUCH DAMAGES AND EVEN IF THE REMEDY FAILS OF ITS ESSENTIAL PURPOSE.</p>
              </div>

              <div>
                <h3 className="text-white font-bold mb-2">6. TERMINATION</h3>
                <p>This Agreement is effective until terminated. Your rights under this Agreement will terminate automatically without notice from the provider if you fail to comply with any of the terms and conditions of this Agreement. Upon termination, you must cease all use of the software and destroy all copies, full or partial, of the software.</p>
              </div>

               <div>
                <h3 className="text-white font-bold mb-2">7. GOVERNING LAW</h3>
                <p>This Agreement shall be governed by and construed in accordance with the laws of the jurisdiction in which the provider is established, without regard to its conflict of law principles.</p>
              </div>
            </div>
          </section>
        )}
      </main>
    </div>
  );
}
