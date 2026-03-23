"use client";

// DailyWikiTip — 日替わりBJJ Wikiページ推薦コンポーネント
// 年の通算日でWikiページをローテーション表示 + 次のヒントプレビュー

import { useState } from "react";
import { useLocale } from "@/lib/i18n";

const WIKI_BASE = "https://wiki.bjj-app.net";

type WikiTip = {
  slug: string;
  titleEn?: string;
  titleJa?: string;
  descEn?: string;
  descJa?: string;
  categoryEn?: string;
  categoryJa?: string;
  lang?: "en" | "ja" | "pt";
};

const WIKI_TIPS: WikiTip[] = [
  // サブミッション
  { slug: "bjj-triangle-choke-guide", titleEn: "Triangle Choke Complete Guide", titleJa: "トライアングルチョーク完全ガイド", descEn: "Detailed explanation from setup to finish", descJa: "セットアップからフィニッシュまで詳細解説", categoryEn: "Submission", categoryJa: "サブミッション" },
  { slug: "bjj-armbar-guide", titleEn: "Armbar Complete Guide", titleJa: "アームバー（腕十字）完全ガイド", descEn: "Armbar from Guard, Mount, and Side Control", descJa: "ガード・マウント・サイドからの腕十字", categoryEn: "Submission", categoryJa: "サブミッション" },
  { slug: "bjj-kimura-lock-guide", titleEn: "Kimura Lock Guide", titleJa: "キムラ（腕がらみ）ガイド", descEn: "Kimura trap system integration methods", descJa: "キムラトラップシステムで連携する方法", categoryEn: "Submission", categoryJa: "サブミッション" },
  { slug: "bjj-omoplata-guide", titleEn: "Omoplata Guide", titleJa: "オモプラータガイド", descEn: "Omoplata combos from guard and applications", descJa: "ガードからのオモプラータ・コンボと使い方", categoryEn: "Submission", categoryJa: "サブミッション" },
  { slug: "bjj-heel-hook-guide", titleEn: "Heel Hook Guide", titleJa: "ヒールフックガイド", descEn: "Outside and inside heel hooks from ashi garami", descJa: "アシガラミからのアウトサイド・インサイドヒールフック", categoryEn: "Leg Lock", categoryJa: "レッグロック" },
  { slug: "bjj-leg-lock-system", titleEn: "Leg Lock System", titleJa: "レッグロックシステム", descEn: "Heel Hook, Knee Reaper, Calf Slicer system", descJa: "ヒールフック・ニーバー・カーフスライサー体系", categoryEn: "Leg Lock", categoryJa: "レッグロック" },
  // ガード
  { slug: "bjj-half-guard-guide", titleEn: "Half Guard Complete Guide", titleJa: "ハーフガード完全ガイド", descEn: "Knee Shield, Underhook, Lockdown", descJa: "ニーシールド・アンダーフック・ロックダウン", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-de-la-riva-guard", titleEn: "De la Riva Guard", titleJa: "デラヒーバガード", descEn: "Entry, Sweep, Back Take", descJa: "エントリー・スウィープ・バックテイク", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-butterfly-guard", titleEn: "Butterfly Guard", titleJa: "バタフライガード", descEn: "Comprehensive guide to hooks, sweeps, back takes", descJa: "フック・スウィープ・バックテイクの総合ガイド", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-x-guard-position-guide", titleEn: "X Guard Position", titleJa: "Xガードポジション", descEn: "X Guard sweeps and leg attacks", descJa: "Xガードからのスウィープとレッグ攻撃", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-rubber-guard-guide", titleEn: "Rubber Guard Guide", titleJa: "ラバーガードガイド", descEn: "Mission Control to Gogoplata", descJa: "ミッションコントロールからゴゴプラタまで", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-guard-retention-advanced", titleEn: "Guard Retention (Advanced)", titleJa: "ガードリテンション（上級）", descEn: "Advanced framing, hip escape, reguard system", descJa: "高度なフレーミング・ヒップエスケープ・リガード体系", categoryEn: "Guard", categoryJa: "ガード" },
  { slug: "bjj-guard-retention-system", titleEn: "Guard Retention System", titleJa: "ガードリテンションシステム", descEn: "Fundamentals of framing, hip escape, reguard", descJa: "フレーミング・ヒップエスケープ・リガードの基礎", categoryEn: "Defense", categoryJa: "ディフェンス" },
  // ポジション
  { slug: "bjj-mount-system", titleEn: "Mount System", titleJa: "マウントシステム", descEn: "Mount control to attacks flow", descJa: "マウントコントロールから攻撃への連携", categoryEn: "Position", categoryJa: "ポジション" },
  { slug: "bjj-back-control-system", titleEn: "Back Control System", titleJa: "バックコントロールシステム", descEn: "Seat belt to RNC and Bow and Arrow", descJa: "シートベルトからRNC・ボウアンドアロー", categoryEn: "Position", categoryJa: "ポジション" },
  { slug: "bjj-back-escape-system", titleEn: "Back Escape System", titleJa: "バックエスケープシステム", descEn: "Roll, seat belt defense, turtle exit", descJa: "ロール・シートベルト対策・タートルからの脱出", categoryEn: "Escape", categoryJa: "エスケープ" },
  // パッシング
  { slug: "bjj-guard-passing-fundamentals", titleEn: "Guard Passing Fundamentals", titleJa: "ガードパスの基礎", descEn: "Pressure pass vs speed pass differentiation", descJa: "プレッシャーパスとスピードパスの使い分け", categoryEn: "Passing", categoryJa: "パッシング" },
  { slug: "bjj-guard-passing-concepts", titleEn: "Guard Passing Concepts", titleJa: "ガードパスの概念", descEn: "Concept-based guard passing system organization", descJa: "コンセプト別ガードパスシステムの体系化", categoryEn: "Passing", categoryJa: "パッシング" },
  // スウィープ
  { slug: "bjj-sweep-fundamentals", titleEn: "Sweep Fundamentals", titleJa: "スウィープの基礎", descEn: "Scissor, hip bump, flower sweep explanation", descJa: "シザー・ヒップバンプ・フラワースウィープ解説", categoryEn: "Sweep", categoryJa: "スウィープ" },
  // テイクダウン
  { slug: "bjj-double-leg-takedown", titleEn: "Double Leg Takedown", titleJa: "ダブルレッグテイクダウン", descEn: "Complete explanation of shot, drive, finish", descJa: "ショット・ドライブ・フィニッシュの完全解説", categoryEn: "Takedown", categoryJa: "テイクダウン" },
  { slug: "bjj-single-leg-takedown", titleEn: "Single Leg Takedown", titleJa: "シングルレッグテイクダウン", descEn: "High C, Running the Pipe, combinations", descJa: "ハイC・ランニングザパイプ・コンボ", categoryEn: "Takedown", categoryJa: "テイクダウン" },
  { slug: "bjj-takedown-entry-systems", titleEn: "Takedown Entry System", titleJa: "テイクダウンエントリーシステム", descEn: "Systematic takedown entries from clinch", descJa: "クリンチからの各種テイクダウン入り方の体系", categoryEn: "Takedown", categoryJa: "テイクダウン" },
  // エスケープ
  { slug: "bjj-mount-escape-system", titleEn: "Mount Escape System", titleJa: "マウントエスケープシステム", descEn: "Bridge, elbow escape, guard reconstruction", descJa: "ブリッジ・エルボーエスケープ・ガード再構築", categoryEn: "Escape", categoryJa: "エスケープ" },
  { slug: "bjj-side-control-escape-guide", titleEn: "Side Control Escape", titleJa: "サイドコントロールエスケープ", descEn: "Frame, hip escape, turtle transition", descJa: "フレーム・ヒップエスケープ・タートル転換", categoryEn: "Escape", categoryJa: "エスケープ" },
  // 競技・メンタル
  { slug: "bjj-competition-mindset", titleEn: "BJJ Competition Mental Game", titleJa: "BJJ競技メンタル", descEn: "Pre/post match mental management and focus", descJa: "試合前後のメンタル管理と集中力の高め方", categoryEn: "Mental", categoryJa: "メンタル" },
  { slug: "bjj-competition-preparation", titleEn: "BJJ Tournament Preparation Guide", titleJa: "BJJ大会準備ガイド", descEn: "Game plan, mental, warm-up", descJa: "ゲームプラン・メンタル・ウォームアップ", categoryEn: "Competition", categoryJa: "競技" },
  { slug: "bjj-sport-psychology", titleEn: "BJJ Sport Psychology", titleJa: "BJJのスポーツ心理学", descEn: "Focus, resilience, competition mental training", descJa: "集中力・レジリエンス・試合メンタルの鍛え方", categoryEn: "Mental", categoryJa: "メンタル" },
  // フィジカル・栄養
  { slug: "bjj-injury-prevention-guide", titleEn: "Injury Prevention Guide", titleJa: "ケガ予防ガイド", descEn: "Common BJJ injury prevention and risk management", descJa: "BJJに多い怪我の予防法とリスク管理", categoryEn: "Physical", categoryJa: "フィジカル" },
  { slug: "bjj-nutrition-science", titleEn: "BJJ Nutrition Science", titleJa: "BJJの栄養科学", descEn: "Science of diet and nutrition for performance", descJa: "パフォーマンスを最大化する食事と栄養の科学", categoryEn: "Nutrition", categoryJa: "栄養" },
  { slug: "bjj-recovery-protocol-bjj", titleEn: "BJJ-Specific Recovery Methods", titleJa: "BJJ特化のリカバリー方法", descEn: "Post-training recovery maximization protocol", descJa: "練習後の回復を最大化するプロトコル", categoryEn: "Physical", categoryJa: "フィジカル" },
  { slug: "bjj-recovery-protocols", titleEn: "Detailed Recovery Protocols", titleJa: "リカバリープロトコル詳細", descEn: "Science-based optimal recovery strategies", descJa: "科学的根拠に基づく最適な回復戦略", categoryEn: "Physical", categoryJa: "フィジカル" },
  { slug: "bjj-grip-strength-training", titleEn: "Grip Strength Training", titleJa: "グリップ強化トレーニング", descEn: "BJJ-specific grip strength development", descJa: "BJJに特化したグリップ筋力の鍛え方", categoryEn: "Physical", categoryJa: "フィジカル" },
  { slug: "bjj-bjj-strength-training", titleEn: "BJJ Strength Training", titleJa: "BJJのための筋力トレーニング", descEn: "S&C programs for BJJ performance", descJa: "柔術パフォーマンスを向上させるS&Cプログラム", categoryEn: "Physical", categoryJa: "フィジカル" },
  // アドバンスト
  { slug: "bjj-gordons-system-guide", titleEn: "Gordon Ryan's System", titleJa: "ゴードン・ライアンのシステム", descEn: "World champion leg lock system analysis", descJa: "ワールドチャンピオンのレッグロックシステム分析", categoryEn: "Advanced", categoryJa: "アドバンスト" },
  { slug: "bjj-marcelo-garcia-system", titleEn: "Marcelo Garcia's System", titleJa: "マルセロ・ガルシアのシステム", descEn: "Guillotine, Back, Butterfly trinity system", descJa: "ギロチン・バック・バタフライの三角体系", categoryEn: "Advanced", categoryJa: "アドバンスト" },
  { slug: "bjj-submission-defense-systems", titleEn: "Submission Defense System", titleJa: "サブミッションディフェンスシステム", descEn: "Defense and escape system for all submissions", descJa: "各種サブミッションへの防御と脱出の体系", categoryEn: "Defense", categoryJa: "ディフェンス" },
  // ビギナー
  { slug: "bjj-complete-beginners-guide", titleEn: "BJJ Complete Beginner Guide", titleJa: "BJJ完全初心者ガイド", descEn: "Essential knowledge and first steps for beginners", descJa: "初心者が知るべき基礎知識と最初の一歩", categoryEn: "Beginner", categoryJa: "ビギナー" },
  { slug: "bjj-blue-belt-guide", titleEn: "Roadmap to Blue Belt", titleJa: "青帯へのロードマップ", descEn: "Skills and mindset for white to blue belt promotion", descJa: "白帯から青帯昇格に必要なスキルと心構え", categoryEn: "Beginner", categoryJa: "ビギナー" },
  // Batch 332-336
  { slug: "bjj-grip-fighting-advanced", titleJa: "グリップファイティング上級", descJa: "グリップ支配・ブレイク・シークエンスの高度な体系", categoryJa: "グリップ" },
  { slug: "bjj-competition-tactics-advanced", titleJa: "競技タクティクス上級", descJa: "ゲームプラン開発・ブラケット管理・メンタル強化", categoryJa: "競技" },
  { slug: "bjj-periodization-training", titleJa: "BJJのピリオダイゼーション", descJa: "マクロ・メソサイクルで競技パフォーマンスを最大化", categoryJa: "フィジカル" },
  { slug: "bjj-nutrition-timing", titleJa: "BJJの栄養タイミング", descJa: "トレーニング前・中・後の栄養補給プロトコル", categoryJa: "栄養" },
  { slug: "bjj-mental-performance", titleJa: "メンタルパフォーマンスBJJ", descJa: "ビジュアライゼーション・自信構築・試合不安管理", categoryJa: "メンタル" },
  // Batch 337-341
  { slug: "bjj-advanced-concepts-guide", titleJa: "BJJアドバンスドコンセプト", descJa: "高レベル柔術の概念的フレームワークと原則体系", categoryJa: "アドバンスト" },
  { slug: "bjj-flow-rolling-advanced", titleJa: "フローローリング上級", descJa: "技術向上のためのフロー状態ロール入門と応用", categoryJa: "アドバンスト" },
  { slug: "bjj-positional-drilling-system", titleJa: "ポジショナルドリリングシステム", descJa: "ポジション別の構造化ドリルで技術を自動化する方法", categoryJa: "テクニック" },
  { slug: "bjj-guard-attacks-advanced-system", titleJa: "ガードアタック上級システム", descJa: "コンビネーションアタックで相手を崩す高度なガード攻撃", categoryJa: "ガード" },
  { slug: "bjj-passing-systems-complete", titleJa: "パッシングシステム完全版", descJa: "プレッシャー・スピード・レッグドラッグの統合パスシステム", categoryJa: "パッシング" },
  // Batch 342-346
  { slug: "bjj-advanced-leg-lock-systems", titleJa: "アドバンスドレッグロックシステム", descJa: "アシガラミエントリーからヒールフックメカニクスまでのモダンレッグロック体系", categoryJa: "レッグロック" },
  { slug: "bjj-competition-game-planning", titleJa: "競技ゲームプランニング", descJa: "ブラケット分析・Aゲーム構築・試合中の調整法", categoryJa: "競技" },
  { slug: "bjj-gi-vs-nogi-comparison", titleJa: "GiとノーギのBJJ比較", descJa: "グリップ差・ガードゲーム・ペース・トレーニング推奨の違い", categoryJa: "テクニック" },
  { slug: "bjj-black-belt-concepts", titleJa: "黒帯コンセプト", descJa: "効率性・感受性・原則ベースの理解で極意を掴む", categoryJa: "アドバンスト" },
  // Batch 347-351
  { slug: "bjj-submission-chain-attacks", titleJa: "サブミッションチェーンアタック", descJa: "サブミッションをつなげて止められない攻撃シーケンスを作る方法", categoryJa: "サブミッション" },
  { slug: "bjj-wrestling-integration", titleJa: "BJJのためのレスリング統合", descJa: "レスリングのテイクダウンとスクランブルをBJJゲームに統合する方法", categoryJa: "テイクダウン" },
  { slug: "bjj-back-system-advanced", titleJa: "バックシステム上級", descJa: "上級者のための完全なバックコントロール・維持・攻撃システム", categoryJa: "ポジション" },
  { slug: "bjj-guard-concepts-advanced", titleJa: "ガードコンセプト上級", descJa: "ガードプレイのハイレベルな概念的フレームワーク", categoryJa: "ガード" },
  { slug: "bjj-competition-prep-advanced", titleJa: "競技準備上級", descJa: "経験豊富な競技者のためのエリートレベル競技準備戦略", categoryJa: "競技" },
  // Batch 352-356
  { slug: "bjj-gi-choke-systems", titleJa: "道衣チョークシステム", descJa: "クロスカラー・ボウアンドアロー・エゼキエル・野球バットチョークをマスター", categoryJa: "サブミッション" },
  { slug: "bjj-half-guard-advanced", titleJa: "上級ハーフガード", descJa: "ディープハーフ・ロックダウン・アンダーフック争いの完全ガイド", categoryJa: "ガード" },
  { slug: "bjj-turtle-top-attacks", titleJa: "タートルトップ攻撃", descJa: "クロックチョーク・バックテイク・レッグ攻撃でタートルを崩す方法", categoryJa: "ポジション" },
  { slug: "bjj-open-guard-transitions", titleJa: "オープンガードトランジション", descJa: "DLR・スパイダー・バタフライ・Xガード間のシームレスな切り替え方法", categoryJa: "ガード" },
  { slug: "bjj-scramble-systems", titleJa: "スクランブルシステム", descJa: "リガード・インバージョン・スタンドアップスクランブルでカオスに勝つ方法", categoryJa: "テクニック" },
  // Batch 357-361
  { slug: "bjj-closed-guard-systems", titleJa: "クローズドガードシステム", descJa: "クラシックとモダンのクローズドガード攻撃・スウィープ・サブミッションシステム", categoryJa: "ガード" },
  { slug: "bjj-north-south-position-attacks", titleJa: "ノースサウス攻撃システム", descJa: "ノースサウスポジションからのキムラ・チョーク・サブミッション体系", categoryJa: "ポジション" },
  { slug: "bjj-knee-on-belly-advanced", titleJa: "ニーオンベリー上級", descJa: "ニーオンベリーからのアームバー・トライアングル・移行システム", categoryJa: "ポジション" },
  { slug: "bjj-crucifix-position-system", titleJa: "クルシフィックスシステム", descJa: "クルシフィックスポジションのエントリー・コントロール・フィニッシュメソッド", categoryJa: "ポジション" },
  { slug: "bjj-twister-system", titleJa: "ツイスターシステム", descJa: "ツイスターサイド・エントリー・フィニッシュのEDIガードシステム完全解説", categoryJa: "テクニック" },
  { slug: "bjj-rubber-guard-advanced", titleJa: "ラバーガード上級システム", descJa: "ミッションコントロール・ニューヨーク・ジュークローとサブミッションチェーン", categoryJa: "ガード" },
  { slug: "bjj-deep-half-guard-mastery", titleJa: "ディープハーフガードマスタリー", descJa: "ウェイタースウィープ・ホーマーシンプソン・バックテイクとレッグアタック", categoryJa: "ガード" },
  { slug: "bjj-leg-entanglement-entries", titleJa: "レッグエンタングルメントエントリー", descJa: "ガード・スクランブル・パッシングからの体系的レッグエンタングルメントエントリー", categoryJa: "レッグロック" },
  { slug: "bjj-back-take-advanced-system", titleJa: "バックテイク上級システム", descJa: "アームドラッグ・ベリンボロ・タートル崩しとバックからのフィニッシングチェーン", categoryJa: "バックコントロール" },
  { slug: "bjj-submission-finishing-details", titleJa: "サブミッションフィニッシング詳細", descJa: "アームバー・トライアングル・裸絞め・ヒールフックの技術的フィニッシング詳細", categoryJa: "サブミッション" },
  // Batch 367-371
  { slug: "bjj-guard-development-system", titleJa: "ガード開発システム", descJa: "体系的なガード構築・強化・切り替えのフレームワーク", categoryJa: "ガード" },
  { slug: "bjj-reaction-training-bjj", titleJa: "BJJリアクショントレーニング", descJa: "スクランブル・カウンター・チェーン反応速度を高める方法", categoryJa: "テクニック" },
  { slug: "bjj-chest-to-chest-control", titleJa: "チェスト・トゥ・チェストコントロール", descJa: "密着コントロール・プレッシャー・サブミッションの統合システム", categoryJa: "ポジション" },
  { slug: "bjj-offense-first-bjj", titleJa: "オフェンスファーストBJJ", descJa: "常に先手を取り主導権を握る積極的なゲームプランニング", categoryJa: "アドバンスト" },
  { slug: "bjj-submission-matrix", titleJa: "サブミッションマトリックス", descJa: "全ポジションから全サブミッションへの体系的チェーンマップ", categoryJa: "サブミッション" },
  // Batch 372-376
  { slug: "bjj-guard-sweeps-masterclass", titleJa: "ガードスウィープマスタークラス", descJa: "ヒップバンプ・シザー・フラワー・サイドスウィープを状況別に使い分ける", categoryJa: "スウィープ" },
  { slug: "bjj-submission-setup-chains", titleJa: "サブミッションセットアップチェーン", descJa: "アームバー→トライアングル→オモプラータの連鎖を止められない攻撃に変える", categoryJa: "サブミッション" },
  { slug: "bjj-mma-guard-work", titleJa: "MMAのためのガードワーク", descJa: "打撃環境でのガード・サブミッション・スウィープの最適戦略", categoryJa: "テクニック" },
  { slug: "bjj-defensive-guard-play", titleJa: "ディフェンシブガードプレイ", descJa: "スペース管理・フレーム・リガードで崩れないガードを作る方法", categoryJa: "ディフェンス" },
  { slug: "bjj-transition-game-advanced", titleJa: "トランジションゲーム上級", descJa: "ポジション間のスムーズな移行でペースを支配する高度な戦略", categoryJa: "アドバンスト" },
  // Batch 377-381
  { slug: "bjj-attacking-from-turtle-advanced", titleJa: "タートルからの上級攻撃", descJa: "タートルポジションからのバックテイク・チョーク・レッグ攻撃の体系", categoryJa: "ポジション" },
  { slug: "bjj-conditioning-science", titleJa: "BJJコンディショニング科学", descJa: "エネルギーシステム・疲労管理・ピーキングの科学的アプローチ", categoryJa: "フィジカル" },
  { slug: "bjj-guard-setups-masterclass", titleJa: "ガードセットアップマスタークラス", descJa: "スタンドアップからのガードプル・座りガード・ジャンプガードの完全ガイド", categoryJa: "ガード" },
  { slug: "bjj-back-control-finishing-details", titleJa: "バックコントロールフィニッシング詳細", descJa: "裸絞め・ボウアンドアロー・アームロックのフィニッシング技術的詳細", categoryJa: "バックコントロール" },
  { slug: "bjj-sweeps-to-submissions", titleJa: "スウィープからサブミッションへ", descJa: "スウィープをサブミッション攻撃に繋げる連鎖メカニクス", categoryJa: "スウィープ" },
  // Batch 382-386
  { slug: "bjj-sweeps-to-submissions-chain-mechanics", titleJa: "スウィープ→サブミッションチェーンメカニクス", descJa: "スウィープ完了後のサブミッション追求のタイミングと角度", categoryJa: "テクニック" },
  { slug: "bjj-pressure-game", titleJa: "プレッシャーゲーム", descJa: "体重・フレーム破壊・圧力パスで相手を制圧するシステム", categoryJa: "パッシング" },
  { slug: "bjj-back-attacks-advanced", titleJa: "バックアタック上級", descJa: "シートベルトからの多角的アタックと防御崩しの高度技術", categoryJa: "バックコントロール" },
  { slug: "bjj-escapes-masterclass", titleJa: "エスケープマスタークラス", descJa: "最悪のポジションから脱出するための原則と実践的テクニック集", categoryJa: "エスケープ" },
  { slug: "bjj-competition-rules-complete", titleJa: "競技ルール完全ガイド", descJa: "IBJJF・ADCC・EBIなど主要大会のルール差異を完全解説", categoryJa: "競技" },
  // Batch 387-391
  { slug: "bjj-advanced-combinations", titleJa: "アドバンスドコンビネーション", descJa: "複数のテクニックを組み合わせた止められない攻撃パターン", categoryJa: "アドバンスト" },
  { slug: "bjj-drilling-methodology", titleJa: "ドリリング方法論", descJa: "技術習得を加速させるドリルの構造・量・パートナーワーク", categoryJa: "テクニック" },
  { slug: "bjj-flow-rolling-mastery", titleJa: "フローローリングマスタリー", descJa: "フロー状態でロールする方法と技術向上への活用法", categoryJa: "アドバンスト" },
  { slug: "bjj-conditioning-science-advanced", titleJa: "コンディショニング科学上級", descJa: "VO2max・無酸素閾値・試合特異的コンディショニングの科学", categoryJa: "フィジカル" },
  { slug: "bjj-nutrition-timing-advanced", titleJa: "栄養タイミング上級", descJa: "試合日・減量・大会後回復の最適栄養プロトコル", categoryJa: "栄養" },
  // Batch 392-396
  { slug: "bjj-guard-systems-advanced", titleJa: "ガードシステム上級", descJa: "複数のガードを組み合わせた統合的ガードゲームの構築法", categoryJa: "ガード" },
  { slug: "bjj-pressure-game-advanced", titleJa: "プレッシャーゲーム上級", descJa: "エリートレベルの圧力パスと体重コントロールのコンセプト", categoryJa: "パッシング" },
  { slug: "bjj-back-attacks-masterclass", titleJa: "バックアタックマスタークラス", descJa: "世界チャンピオンが使うバック攻撃の詳細メカニクス", categoryJa: "バックコントロール" },
  { slug: "bjj-escapes-advanced", titleJa: "エスケープ上級", descJa: "難しいポジションからの脱出と即時カウンター攻撃の組み合わせ", categoryJa: "エスケープ" },
  { slug: "bjj-competition-rules-detailed", titleJa: "競技ルール詳細解説", descJa: "ペナルティ・アドバンテージ・VTBルールの戦略的活用法", categoryJa: "競技" },
  // Batch 402-406
  { slug: "bjj-guard-pulling-strategy", titleJa: "ガードプル戦略", descJa: "スタンドアップからガードプルへの移行タイミングと戦略", categoryJa: "ガード" },
  { slug: "bjj-open-guard-mastery", titleJa: "オープンガードマスタリー", descJa: "オープンガードのポジション管理・スウィープ・サブミッション体系", categoryJa: "ガード" },
  { slug: "bjj-top-pressure-advanced", titleJa: "トッププレッシャー上級", descJa: "サイドコントロール・ニーオンベリー・マウントでの重量配分とプレッシャー", categoryJa: "ポジション" },
  { slug: "bjj-submission-hunting", titleJa: "サブミッションハンティング", descJa: "常にサブミッションを狙い続けるアグレッシブなゲームプラン", categoryJa: "サブミッション" },
  { slug: "bjj-tournament-preparation", titleJa: "トーナメント準備完全版", descJa: "大会12週前からの準備・ピーキング・当日戦略の完全ガイド", categoryJa: "競技" },
  // Batch 407-411
  { slug: "bjj-passing-guard-fundamentals", titleJa: "ガードパス基礎原則", descJa: "ガードパスに必要な姿勢・圧力・タイミングの基本原則", categoryJa: "パッシング" },
  { slug: "bjj-closed-guard-attacks", titleJa: "クローズドガード攻撃", descJa: "クローズドガードからのスウィープ・チョーク・アームロックの完全システム", categoryJa: "ガード" },
  { slug: "bjj-side-control-positions", titleJa: "サイドコントロールポジション", descJa: "サイドコントロールの種類・移行・攻撃オプションの体系的ガイド", categoryJa: "ポジション" },
  { slug: "bjj-back-take-entries", titleJa: "バックテイクエントリー", descJa: "各ポジションからバックを取るための体系的なエントリーシステム", categoryJa: "バックコントロール" },
  { slug: "bjj-knee-on-belly-control", titleJa: "ニーオンベリーコントロール", descJa: "ニーオンベリーでの圧力・維持・サブミッション攻撃の詳細ガイド", categoryJa: "ポジション" },
];

const CATEGORY_COLORS: Record<string, string> = {
  // English
  "Submission": "bg-red-500/20 text-red-300",
  "Leg Lock": "bg-pink-500/20 text-pink-300",
  "Guard": "bg-blue-500/20 text-blue-300",
  "Position": "bg-indigo-500/20 text-indigo-300",
  "Defense": "bg-cyan-500/20 text-cyan-300",
  "Passing": "bg-orange-500/20 text-orange-300",
  "Sweep": "bg-yellow-500/20 text-yellow-300",
  "Takedown": "bg-green-500/20 text-green-300",
  "Escape": "bg-teal-500/20 text-teal-300",
  "Competition": "bg-purple-500/20 text-purple-300",
  "Mental": "bg-violet-500/20 text-violet-300",
  "Physical": "bg-emerald-500/20 text-emerald-300",
  "Nutrition": "bg-lime-500/20 text-lime-300",
  "Advanced": "bg-rose-500/20 text-rose-300",
  "Beginner": "bg-sky-500/20 text-sky-300",
  "Grip": "bg-amber-500/20 text-amber-300",
  "Technique": "bg-blue-600/20 text-blue-200",
  "Back Control": "bg-fuchsia-500/20 text-fuchsia-300",
  // Japanese
  "サブミッション": "bg-red-500/20 text-red-300",
  "レッグロック": "bg-pink-500/20 text-pink-300",
  "ガード": "bg-blue-500/20 text-blue-300",
  "ポジション": "bg-indigo-500/20 text-indigo-300",
  "ディフェンス": "bg-cyan-500/20 text-cyan-300",
  "パッシング": "bg-orange-500/20 text-orange-300",
  "スウィープ": "bg-yellow-500/20 text-yellow-300",
  "テイクダウン": "bg-green-500/20 text-green-300",
  "エスケープ": "bg-teal-500/20 text-teal-300",
  "競技": "bg-purple-500/20 text-purple-300",
  "メンタル": "bg-violet-500/20 text-violet-300",
  "フィジカル": "bg-emerald-500/20 text-emerald-300",
  "栄養": "bg-lime-500/20 text-lime-300",
  "アドバンスト": "bg-rose-500/20 text-rose-300",
  "ビギナー": "bg-sky-500/20 text-sky-300",
  "グリップ": "bg-amber-500/20 text-amber-300",
  "テクニック": "bg-blue-600/20 text-blue-200",
  "バックコントロール": "bg-fuchsia-500/20 text-fuchsia-300",
};

export default function DailyWikiTip() {
  const { locale, t } = useLocale();
  const [showNext, setShowNext] = useState(false);
  const [isOpen, setIsOpen] = useState(false);

  const today = new Date(Date.now() + 9 * 60 * 60 * 1000);
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
      86400000
  );
  const tip = WIKI_TIPS[dayOfYear % WIKI_TIPS.length];
  const tipNext = WIKI_TIPS[(dayOfYear + 1) % WIKI_TIPS.length];
  const lang = tip.lang ?? (locale === "en" ? "en" : "ja");
  const wikiUrl = `${WIKI_BASE}/${lang}/${tip.slug}.html`;
  const nextLang = tipNext.lang ?? (locale === "en" ? "en" : "ja");
  const nextUrl = `${WIKI_BASE}/${nextLang}/${tipNext.slug}.html`;
  const tipTitle = locale === "en" ? tip.titleEn : tip.titleJa;
  const tipDesc = locale === "en" ? tip.descEn : tip.descJa;
  const tipCategory = locale === "en" ? tip.categoryEn : tip.categoryJa;
  const nextTitle = locale === "en" ? tipNext.titleEn : tipNext.titleJa;
  const nextDesc = locale === "en" ? tipNext.descEn : tipNext.descJa;
  const nextCategory = locale === "en" ? tipNext.categoryEn : tipNext.categoryJa;
  const badgeClass = CATEGORY_COLORS[tipCategory ?? ""] ?? "bg-zinc-500/20 text-zinc-300";
  const nextBadgeClass = CATEGORY_COLORS[nextCategory ?? ""] ?? "bg-zinc-500/20 text-zinc-300";

  return (
    <div className="bg-zinc-900 rounded-xl border border-white/10 overflow-hidden">
      <button
        onClick={() => setIsOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-white/5 transition-colors text-left"
      >
        <div className="flex items-center gap-2 min-w-0">
          <span className="text-base flex-shrink-0">📚</span>
          <span className="text-xs text-gray-400 font-medium flex-shrink-0">{t("wiki.dailyTip")}</span>
          {!isOpen && (
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium truncate ${badgeClass}`}>
              {tipCategory}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 transition-transform duration-200 flex-shrink-0 ml-2 ${isOpen ? "rotate-180" : ""}`}
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {isOpen && (<div className="px-4 pb-4 pt-1 border-t border-white/10">
      <div className="flex items-center gap-2 mb-3">
        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${badgeClass}`}>
          {tipCategory}
        </span>
      </div>
      <h3 className="text-sm font-semibold text-zinc-100 mb-1 leading-snug">{tipTitle}</h3>
      <p className="text-xs text-gray-400 mb-3 leading-relaxed">{tipDesc}</p>
      <div className="flex items-center justify-between">
        <a
          href={wikiUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-xs text-[#3B82F6] hover:text-blue-400 transition-colors font-medium"
        >
          <span>{t("wiki.readMore")}</span>
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
        <button
          onClick={() => setShowNext((v) => !v)}
          className="text-[10px] text-gray-600 hover:text-gray-400 transition-colors flex items-center gap-1"
        >
          {showNext ? t("wiki.close") : t("wiki.nextPreview", { categoryJa: nextCategory ?? "" })}
        </button>
      </div>

      {/* 次のヒントプレビュー — スライドアニメーション */}
      <div
        className="overflow-hidden transition-all duration-300 ease-in-out"
        style={{ maxHeight: showNext ? "160px" : "0px" }}
      >
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[10px] text-gray-600">{t("wiki.nextHint")}</span>
            <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${nextBadgeClass}`}>
              {nextCategory}
            </span>
          </div>
          <h4 className="text-xs font-semibold text-gray-300 mb-1 leading-snug">{nextTitle}</h4>
          <p className="text-[11px] text-gray-500 mb-2 leading-relaxed">{nextDesc}</p>
          <a
            href={nextUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] text-gray-600 hover:text-gray-300 transition-colors"
          >
            <span>{t("wiki.peekAhead")}</span>
          </a>
        </div>
      </div>
      </div>)}
    </div>
  );
}
