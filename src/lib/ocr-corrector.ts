/**
 * OCR错误纠正模块
 * 用于纠正常见的OCR识别错误，如乱码、字符替换等
 */

import { CorrectionRule, OcrCorrectionConfig } from '../types';

export class OcrCorrector {
  private correctionRules: Array<{pattern: RegExp, replacement: string}>;

  constructor(config?: Partial<OcrCorrectionConfig>) {
    const mergedConfig: OcrCorrectionConfig = {
      enabled: true,
      rules: [],
      useDefaultRules: true,
      ...config
    };

    this.correctionRules = [];

    // 添加默认规则（如果启用）
    if (mergedConfig.useDefaultRules) {
      this.correctionRules.push(...this.getDefaultRules());
    }

    // 添加用户自定义规则
    if (mergedConfig.rules && mergedConfig.rules.length > 0) {
      this.correctionRules.push(...mergedConfig.rules.map(rule => ({
        pattern: new RegExp(rule.pattern, 'g'),
        replacement: rule.replacement
      })));
    }
  }

  /**
   * 获取默认的OCR纠正规则
   * 基于常见OCR错误模式
   */
  private getDefaultRules(): Array<{pattern: RegExp, replacement: string}> {
    return [
      // 常见OCR错误模式
      { pattern: /ro\s+oobeontrolNo\s*End/g, replacement: 'rig control' },
      { pattern: /ro\s+oobotroNo\s*0\s*Start/g, replacement: 'rig control' },
      { pattern: /nGotrolNlt\s+Ctae/g, replacement: 'rig control' },
      { pattern: /bQontrolN@t\s+Oa\s+E\s*0\s*Cta/g, replacement: 'rig control' },
      { pattern: /bQontrolN@t\s+E\s*0\s*Cta/g, replacement: 'rig control' },
      { pattern: /nQotroNo\s+Ctae/g, replacement: 'rig control' },
      { pattern: /ntrolNe\s+Endn\s+Ctae\s+En/g, replacement: 'rig control' },
      { pattern: /eotroNo/g, replacement: 'rig control' },
      { pattern: /E\s+roNo\s+C/g, replacement: 'rig control' },

      // Fingers Grasp 相关UI文本（通常为无关信息，移除）
      { pattern: /Fingers\s*\.?\s*Grasp\s*0\.000/g, replacement: '' },
      { pattern: /FingersGrasp\s*0\.000/g, replacement: '' },
      { pattern: /Fingers\s*Grasp\s*0\.000/g, replacement: '' },

      // SnapChild 相关错误
      { pattern: /Snapcildofco/g, replacement: '' },
      { pattern: /Snapcildofco/g, replacement: '' },
      { pattern: /SnapChildofo/g, replacement: '' },
      { pattern: /taSnapChild/g, replacement: '' },
      { pattern: /teSnapChild/g, replacement: '' },
      { pattern: /toSnapChild/g, replacement: '' },
      { pattern: /LSnapChild/g, replacement: '' },
      { pattern: /esnapChilid/g, replacement: '' },
      { pattern: /Snap\.?Child/g, replacement: '' },
      { pattern: /SnapChild/g, replacement: '' },

      // RotationMode 相关
      { pattern: /RotationMode/g, replacement: '' },
      { pattern: /Roonooe/g, replacement: '' },
      { pattern: /otationMode/g, replacement: '' },
      { pattern: /otathonMode/g, replacement: '' },
      { pattern: /othooMode/g, replacement: '' },

      // AllPos / Pose 相关
      { pattern: /AllPos/g, replacement: '' },
      { pattern: /AllPose/g, replacement: '' },
      { pattern: /ResetAllPose/g, replacement: '' },
      { pattern: /ReetAlPose/g, replacement: '' },
      { pattern: /Re AllPose/g, replacement: '' },
      { pattern: /ResetAPos/g, replacement: '' },
      { pattern: /esetAPos/g, replacement: '' },
      { pattern: /eeea Pn/g, replacement: '' },
      { pattern: /etA en/g, replacement: '' },
      { pattern: /eeetAll n/g, replacement: '' },

      // HAT 相关（可能是UI按钮）
      { pattern: /HATT/g, replacement: '' },
      { pattern: /HAT/g, replacement: '' },
      { pattern: /HATN/g, replacement: '' },
      { pattern: /HAP/g, replacement: '' },

      // 示例文件中的常见错误
      { pattern: /reguired[']?foreachControlNet/g, replacement: 'required for each ControlNet' },
      { pattern: /reguired/g, replacement: 'required' },
      { pattern: /foreachControlNet/g, replacement: 'for each ControlNet' },
      { pattern: /Save\s+Zip\s+Send\s+to/g, replacement: '' },
      { pattern: /ConfigPresets/g, replacement: '' },
      { pattern: /imgimg/g, replacement: '' },
      { pattern: /inpaint/g, replacement: '' },
      { pattern: /Sendto/g, replacement: '' },
      { pattern: /ResetAllPo/g, replacement: '' },
      { pattern: /ReetAllPoe/g, replacement: '' },
      { pattern: /ReetAlPo/g, replacement: '' },
      { pattern: /Praeh/g, replacement: '' },
      { pattern: /Trackba/g, replacement: '' },
      { pattern: /Trah/g, replacement: '' },
      // 乱码检测
      { pattern: /\b[HHAI]{3,}\b/g, replacement: '' },
      { pattern: /\b[A-Z]{5,}\b/g, replacement: '' }, // 连续5个以上大写字母
      { pattern: /AI二/g, replacement: '' },

      // Picke / Pick 相关
      { pattern: /Picke/g, replacement: '' },
      { pattern: />Picke/g, replacement: '' },
      { pattern: /Pcke/g, replacement: '' },
      { pattern: /Pc/g, replacement: '' },
      { pattern: /Pakoe/g, replacement: '' },
      { pattern: /Pel/g, replacement: '' },
      { pattern: /Pc nd100/g, replacement: '' },

      // End / Start 相关数字（可能为UI状态）
      { pattern: /\bEnd\b/g, replacement: '' },
      { pattern: /\bStart\b/g, replacement: '' },
      { pattern: /\bEnd100\b/g, replacement: '' },
      { pattern: /\bFnd100\b/g, replacement: '' },
      { pattern: /\bFd100\b/g, replacement: '' },
      { pattern: /\bFod\b/g, replacement: '' },
      { pattern: /\bFnd\b/g, replacement: '' },
      { pattern: /\bEod\b/g, replacement: '' },
      { pattern: /\bStad\b/g, replacement: '' },
      { pattern: /\bStar\b/g, replacement: '' },
      { pattern: /\bStat\b/g, replacement: '' },
      { pattern: /\bSa\b/g, replacement: '' },
      { pattern: /\bStad\b/g, replacement: '' },

      // 数字和特殊字符（可能为UI坐标）
      { pattern: /\b\d+\.\d+\b/g, replacement: '' }, // 浮点数
      { pattern: /\b\d+\b/g, replacement: '' },      // 整数（谨慎使用，可能移除有效数字）
      { pattern: /[0-9]+/g, replacement: '' },       // 所有数字

      // 清理多余空格和标点
      { pattern: /\s+/g, replacement: ' ' },         // 多个空格合并为一个
      { pattern: /^\s+|\s+$/g, replacement: '' },    // 去除首尾空格
      { pattern: /[.,;:!?]{2,}/g, replacement: '' }, // 重复标点
    ];
  }

  /**
   * 纠正OCR识别文本
   * @param text 原始OCR识别文本
   * @returns 纠正后的文本
   */
  correct(text: string): string {
    if (!text || typeof text !== 'string') {
      return '';
    }

    let result = text;

    // 应用所有纠正规则
    for (const rule of this.correctionRules) {
      result = result.replace(rule.pattern, rule.replacement);
    }

    // 最终清理：去除多余空格、标点
    result = result
      .replace(/\s+/g, ' ')
      .replace(/^\s+|\s+$/g, '')
      .replace(/([.,;:!?])\1+/g, '$1') // 去除重复标点
      .trim();

    return result;
  }

  /**
   * 批量纠正文本
   * @param texts 原始OCR识别文本数组
   * @returns 纠正后的文本数组
   */
  correctBatch(texts: string[]): string[] {
    return texts.map(text => this.correct(text));
  }

  /**
   * 添加新的纠正规则
   * @param rule 纠正规则
   */
  addRule(rule: CorrectionRule): void {
    this.correctionRules.push({
      pattern: new RegExp(rule.pattern, 'g'),
      replacement: rule.replacement
    });
  }

  /**
   * 移除所有纠正规则
   */
  clearRules(): void {
    this.correctionRules = [];
  }

  /**
   * 获取当前所有规则
   */
  getRules(): Array<{pattern: RegExp, replacement: string}> {
    return [...this.correctionRules];
  }

  /**
   * 创建默认的单例实例
   */
  static createDefault(): OcrCorrector {
    return new OcrCorrector({
      enabled: true,
      useDefaultRules: true,
      rules: []
    });
  }
}