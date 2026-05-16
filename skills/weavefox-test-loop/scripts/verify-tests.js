#!/usr/bin/env node
/**
 * Test Quality Verification Script
 * Detects fake/placeholder tests that don't contribute to coverage
 *
 * 支持两种模式:
 * 1. 标准模式: 分析测试文件中的反模式
 * 2. 沙箱模式 (--sandbox): 静态代码分析，不运行测试
 * 3. 源码分析模式 (--analyze <file>): 分析源文件分支覆盖情况
 * 4. 报告模式 (--report): 生成基于源码分析的覆盖报告
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');

// 解析命令行参数
const args = process.argv.slice(2);
const isSandboxMode = args.includes('--sandbox');
const isAnalyzeMode = args.includes('--analyze');
const isReportMode = args.includes('--report');
const isJsonMode = args.includes('--json');
const analyzeTarget = isAnalyzeMode ? args[args.indexOf('--analyze') + 1] : null;

// Anti-patterns that indicate fake tests
const ANTI_PATTERNS = [
  {
    name: 'Input self-assertion',
    regex: /assert\.strictEqual\(\s*input\.[a-zA-Z_]+\s*,\s*['"`][^'"`]*['"`]\s*\)/g,
    severity: 'CRITICAL',
    description: 'Testing input equals itself - zero coverage contribution'
  },
  {
    name: 'Typeof function check',
    regex: /typeof\s+\w+\s*===?\s*['"]function['"]/g,
    severity: 'CRITICAL',
    description: 'Only verifying method exists - zero coverage contribution'
  },
  {
    name: 'Undefined check only',
    regex: /assert\.(ok|strictEqual)\([^)]*undefined[^)]*\)/g,
    severity: 'HIGH',
    description: 'Only checking not undefined - no behavior verification'
  },
  {
    name: 'No function call in test',
    regex: /it\(['"`][^'"`]+['"`]\s*,\s*\(\)\s*=>\s*\{[\s\S]{0,500}?\}\s*\);/g,
    severity: 'CRITICAL',
    description: 'Test body too short - likely not calling actual function',
    check: (match) => {
      // Check if any function call exists in the test
      const hasFunctionCall = /\w+\([^)]*\)/.test(match);
      const hasAssert = /assert\./.test(match);
      return hasAssert && !hasFunctionCall;
    }
  },
  {
    name: 'Only creating objects',
    regex: /const\s+\w+\s*=\s*\{[^}]+\};\s*assert\./g,
    severity: 'CRITICAL',
    description: 'Only creating objects and asserting - no function execution'
  },
  {
    name: 'Assert true only',
    regex: /assert\.(ok|strictEqual)\(\s*true\s*\)/g,
    severity: 'CRITICAL',
    description: 'Asserting true equals true - meaningless test'
  },
  {
    name: 'No actual function invocation',
    regex: /it\(['"`][^'"`]+['"`]\s*,\s*async?\s*\(\)\s*=>\s*\{\s*const\s+\w+\s*=\s*\{[^}]+\};\s*\}\s*\);/g,
    severity: 'CRITICAL',
    description: 'Test creates objects but never calls the function under test'
  }
];

/**
 * 从测试文件中提取被测函数调用
 */
function extractTestedFunctions(testContent) {
  const testedFunctions = new Set();

  // 匹配 service.method(...) 或 functionName(...)
  const patterns = [
    /(\w+)Service\.(\w+)\s*\(/g,
    /await\s+(\w+)Service\.(\w+)\s*\(/g,
    /(\w+)\.(\w+)\s*\(/g,
    /await\s+(\w+)\.(\w+)\s*\(/g,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(testContent)) !== null) {
      testedFunctions.add(`${match[1]}.${match[2]}`);
    }
  });

  return Array.from(testedFunctions);
}

/**
 * 检测测试是否使用了 Mock 数据库查询模式
 */
function detectMockDatabasePattern(testContent) {
  const patterns = {
    mmMock: /mm\([^)]+,\s*['"](findAll|findOne|findById|count|readArray|readJSON)['"]/g,
    boneMock: /ctx\.bone\.\w+\.(findAll|findOne|findById|count)/g,
    serviceMock: /app\.mockService\(/g,
  };

  const results = {};
  for (const [name, pattern] of Object.entries(patterns)) {
    const matches = testContent.match(pattern) || [];
    results[name] = matches.length;
  }

  return {
    hasMockPattern: results.mmMock > 0 || results.serviceMock > 0,
    mockCount: results.mmMock + results.serviceMock,
    details: results,
  };
}

/**
 * 从源码中提取所有分支点 (if/else/switch/catch/ternary)
 */
function extractBranches(sourceContent) {
  const branches = [];
  const lines = sourceContent.split('\n');

  lines.forEach((line, index) => {
    const lineNum = index + 1;
    const trimmed = line.trim();

    // if 语句
    if (/^if\s*\(/.test(trimmed)) {
      branches.push({
        type: 'if',
        line: lineNum,
        condition: trimmed.match(/if\s*\(([^)]+)\)/)?.[1] || 'unknown'
      });
    }
    // else if
    else if (/^else\s+if\s*\(/.test(trimmed)) {
      branches.push({
        type: 'else-if',
        line: lineNum,
        condition: trimmed.match(/else\s+if\s*\(([^)]+)\)/)?.[1] || 'unknown'
      });
    }
    // else
    else if (/^else\s*\{?\s*$/.test(trimmed)) {
      branches.push({
        type: 'else',
        line: lineNum,
        condition: 'else branch'
      });
    }
    // switch case
    else if (/^case\s+/.test(trimmed)) {
      branches.push({
        type: 'case',
        line: lineNum,
        condition: trimmed.match(/case\s+([^:]+):/)?.[1] || 'unknown'
      });
    }
    // default
    else if (/^default\s*:/.test(trimmed)) {
      branches.push({
        type: 'default',
        line: lineNum,
        condition: 'default case'
      });
    }
    // try
    else if (/^try\s*\{/.test(trimmed)) {
      branches.push({
        type: 'try',
        line: lineNum,
        condition: 'try block'
      });
    }
    // catch
    else if (/^catch\s*\(/.test(trimmed)) {
      branches.push({
        type: 'catch',
        line: lineNum,
        condition: trimmed.match(/catch\s*\(([^)]+)\)/)?.[1] || 'error'
      });
    }
    // ternary operator
    else if (/\?\s*[^:]+:/.test(trimmed)) {
      branches.push({
        type: 'ternary',
        line: lineNum,
        condition: 'ternary operator'
      });
    }
    // throw
    else if (/^throw\s+/.test(trimmed)) {
      branches.push({
        type: 'throw',
        line: lineNum,
        condition: 'exception throw'
      });
    }
  });

  return branches;
}

/**
 * 从源码中提取所有函数/方法定义
 */
function extractFunctions(sourceContent) {
  const functions = [];
  const patterns = [
    // async methodName(
    /async\s+(\w+)\s*\(/g,
    // methodName(
    /^(?!.*=>)(\w+)\s*\([^)]*\)\s*[:\{]/gm,
    // const/var/let name = async function
    /(?:const|let|var)\s+(\w+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>)/g,
  ];

  patterns.forEach(pattern => {
    let match;
    while ((match = pattern.exec(sourceContent)) !== null) {
      functions.push(match[1]);
    }
  });

  return [...new Set(functions)];
}

/**
 * 检查测试是否覆盖了特定分支
 */
function checkBranchCoverage(testContent, branches) {
  const coveredBranches = [];
  const uncoveredBranches = [];

  branches.forEach(branch => {
    // 检查测试描述中是否包含行号引用
    const linePattern = new RegExp(`line\\s+${branch.line}[^\\d]|${branch.line}[-~]\\d+|L${branch.line}[^\\d]`, 'i');
    const hasLineReference = linePattern.test(testContent);

    // 检查测试描述中是否包含分支类型关键词
    const typeKeywords = {
      'if': ['if', 'when', 'condition', branch.condition.toLowerCase()],
      'else-if': ['else if', 'elseif', branch.condition.toLowerCase()],
      'else': ['else', 'otherwise', 'default'],
      'case': ['case', branch.condition.toLowerCase()],
      'default': ['default', 'fallback'],
      'catch': ['catch', 'error', 'exception', 'throw', 'reject'],
      'throw': ['throw', 'error', 'exception', 'reject'],
      'ternary': ['ternary', 'conditional', '?']
    };

    const keywords = typeKeywords[branch.type] || [branch.type];
    const hasTypeReference = keywords.some(kw =>
      testContent.toLowerCase().includes(kw.toLowerCase())
    );

    if (hasLineReference || hasTypeReference) {
      coveredBranches.push(branch);
    } else {
      uncoveredBranches.push(branch);
    }
  });

  return { coveredBranches, uncoveredBranches };
}

function analyzeTestFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf-8');
  const issues = [];

  ANTI_PATTERNS.forEach(pattern => {
    const matches = content.match(pattern.regex) || [];
    matches.forEach(match => {
      if (!pattern.check || pattern.check(match)) {
        issues.push({
          pattern: pattern.name,
          severity: pattern.severity,
          description: pattern.description,
          snippet: match.substring(0, 100)
        });
      }
    });
  });

  // 沙箱模式: 额外检查函数调用
  if (isSandboxMode) {
    const testedFunctions = extractTestedFunctions(content);
    const itBlocks = content.match(/it\(['"`][^'"`]+['"`]\s*,/g) || [];

    // 检查每个 it 块是否包含实际函数调用
    itBlocks.forEach((block, idx) => {
      const blockStart = content.indexOf(block);
      const nextBlock = itBlocks[idx + 1];
      const blockEnd = nextBlock ? content.indexOf(nextBlock) : content.length;
      const blockContent = content.substring(blockStart, blockEnd);

      // 检查是否只有对象创建和输入断言
      const hasOnlyObjectCreation = /const\s+\w+\s*=\s*\{[^}]+\}/.test(blockContent) &&
        !/await\s+\w+\.(\w+)\s*\(/.test(blockContent) &&
        !/\w+Service\.(\w+)\s*\(/.test(blockContent);

      if (hasOnlyObjectCreation && blockContent.includes('assert.')) {
        issues.push({
          pattern: 'No actual service call in test',
          severity: 'CRITICAL',
          description: `Test '${block.slice(3, -2)}' only creates objects without calling service methods`,
          snippet: block.substring(0, 80)
        });
      }
    });

    // 检测 Mock 数据库查询模式
    const mockPattern = detectMockDatabasePattern(content);
    if (mockPattern.hasMockPattern) {
      console.log(`   ✅ Detected Mock DB Pattern: ${mockPattern.mockCount} mocks found`);
    }
  }

  return {
    file: filePath,
    issues,
    testedFunctions: extractTestedFunctions(content),
    hasCriticalIssues: issues.some(i => i.severity === 'CRITICAL')
  };
}

/**
 * 分析源文件与测试文件的覆盖关系
 */
function analyzeSourceCoverage(sourceFile) {
  if (!fs.existsSync(sourceFile)) {
    console.error(`❌ Source file not found: ${sourceFile}`);
    process.exit(1);
  }

  const sourceContent = fs.readFileSync(sourceFile, 'utf-8');
  const sourceLines = sourceContent.split('\n');
  const branches = extractBranches(sourceContent);
  const functions = extractFunctions(sourceContent);

  // 查找对应的测试文件
  const possibleTestPaths = [
    sourceFile.replace('/app/', '/test/app/').replace('.ts', '.test.ts'),
    sourceFile.replace('app/', 'test/').replace('.ts', '.test.ts'),
    sourceFile.replace('/service/', '/test/service/').replace('.ts', '.test.ts'),
    'test/' + sourceFile.replace('.ts', '.test.ts'),
  ];

  let testFile = null;
  let testContent = '';

  for (const testPath of possibleTestPaths) {
    if (fs.existsSync(testPath)) {
      testFile = testPath;
      testContent = fs.readFileSync(testPath, 'utf-8');
      break;
    }
  }

  // 如果没有找到测试文件，尝试 glob 搜索
  if (!testFile) {
    const fileName = path.basename(sourceFile, '.ts');
    const searchPatterns = [
      `test/**/*${fileName}*.test.ts`,
      `app/modules/**/test/**/*${fileName}*.test.ts`,
    ];

    for (const pattern of searchPatterns) {
      const matches = glob.sync(pattern, { cwd: process.cwd() });
      if (matches.length > 0) {
        testFile = matches[0];
        testContent = fs.readFileSync(testFile, 'utf-8');
        break;
      }
    }
  }

  const coverage = checkBranchCoverage(testContent, branches);

  // 检测文件类型
  const fileType = detectFileType(sourceFile);

  // 为未覆盖的分支添加上下文代码
  const uncoveredBranchesWithContext = coverage.uncoveredBranches.map(branch => {
    const lineIndex = branch.line - 1;
    const contextLines = [];

    // 获取前后3行作为上下文
    for (let i = Math.max(0, lineIndex - 3); i <= Math.min(sourceLines.length - 1, lineIndex + 3); i++) {
      contextLines.push({
        lineNum: i + 1,
        code: sourceLines[i],
        isTarget: i === lineIndex
      });
    }

    return {
      ...branch,
      context: contextLines,
      suggestedTest: generateTestSuggestion(branch, sourceLines[lineIndex], fileType)
    };
  });

  // 估算覆盖率
  const branchCoverage = branches.length > 0
    ? (coverage.coveredBranches.length / branches.length) * 100
    : 100;

  // 经验公式：行覆盖率通常比分支覆盖率高 10-15%
  // 因为一行可能包含多个分支，或者有些行没有分支
  const estimatedLineCoverage = Math.min(100, branchCoverage * 0.85 + 10);

  return {
    sourceFile,
    testFile,
    fileType,
    totalBranches: branches.length,
    coveredBranches: coverage.coveredBranches.length,
    uncoveredBranches: uncoveredBranchesWithContext,
    totalFunctions: functions.length,
    branchCoverage: branchCoverage.toFixed(2),
    estimatedLineCoverage: estimatedLineCoverage.toFixed(2),
    coverageInferenceMethod: 'Static analysis based on test descriptions and branch keywords',
    testStrategy: getTestStrategyForFileType(fileType)
  };
}

/**
 * 获取文件类型的测试策略
 */
function getTestStrategyForFileType(fileType) {
  const strategies = {
    service: {
      description: 'Service 层测试 - 需要 Mock 外部依赖',
      setup: `
import assert from 'assert';
import { app } from '@alipay/chair-bin/unittest';
import { TargetService } from '../../service/TargetService';

describe('app/modules/{module}/service/TargetService.test.ts', () => {
  let targetService: TargetService;
  let user;

  beforeEach(async () => {
    user = await create('user');
    mockUser(user);
    targetService = await app.getEggObject(TargetService);
  });

  // Add your tests here
});`,
      mocks: [
        "app.mockService('dependencyService', 'methodName', async () => ({ ... }))",
        "app.mockService('oneapi', 'serviceName', { ApiName: { method: async () => ({}) } })",
        "mock(app, 'mq', { publish: async (data) => data })"
      ],
      keyPoints: [
        'Mock 所有外部 Service 调用',
        '测试正常路径、错误路径、边界条件',
        '验证返回值和副作用',
        '使用 await assert.rejects() 测试异常'
      ]
    },
    controller: {
      description: 'Controller 层测试 - HTTP 请求测试',
      setup: `
import assert from 'assert';

describe('test/controller/api/web/feature.test.ts', () => {
  // Add your tests here
});`,
      mocks: [
        "app.mockService('serviceName', 'methodName', async () => ({ ... }))"
      ],
      keyPoints: [
        '测试登录要求 (should require login)',
        '测试参数验证',
        '测试 HTTP 状态码 (200, 302, 400, 401)',
        '使用 app.httpRequest() 发送请求'
      ]
    },
    utils: {
      description: 'Utils 测试 - 纯函数测试',
      setup: `
import assert from 'assert';
import { pureFunction } from '../../../app/modules/module/utils/helper';

describe('module/utils/helper.test.ts', () => {
  // Add your tests here
});`,
      mocks: [],
      keyPoints: [
        '测试边界值 (0, -1, null, undefined, empty string)',
        '测试正常输入',
        '测试异常输入',
        '使用 assert.strictEqual() 精确匹配返回值'
      ]
    },
    constants: {
      description: 'Constants 测试 - 常量验证',
      setup: `
import assert from 'assert';
import { CONSTANT_NAME } from '../../../app/modules/module/common/constants';

describe('module/common/constants.test.ts', () => {
  // Add your tests here
});`,
      mocks: [],
      keyPoints: [
        '验证常量值正确',
        '验证枚举值正确'
      ]
    },
    schedule: {
      description: 'Schedule 测试 - 定时任务测试',
      setup: `
import assert from 'assert';

describe('app/schedule/schedule_task.test.ts', () => {
  // Add your tests here
});`,
      mocks: [
        "app.mockService('targetService', 'methodName', async () => true)"
      ],
      keyPoints: [
        'Mock Service 依赖',
        '使用 await app.runSchedule("schedule_name") 执行',
        '验证任务执行无错误'
      ]
    },
    general: {
      description: '通用测试策略',
      setup: '请根据文件类型选择合适的测试模板',
      mocks: [],
      keyPoints: [
        '识别文件类型',
        '选择合适的测试模板',
        '确保测试覆盖所有分支'
      ]
    }
  };

  return strategies[fileType] || strategies.general;
}

/**
 * 生成测试建议
 */
function generateTestSuggestion(branch, lineCode, fileType = 'general') {
  const suggestions = {
    'if': `Test when condition is false: ${branch.condition}`,
    'else-if': `Test this specific else-if condition: ${branch.condition}`,
    'else': 'Test the else branch scenario',
    'case': `Test case: ${branch.condition}`,
    'default': 'Test the default case scenario',
    'catch': `Test error handling: ${branch.condition}`,
    'throw': 'Test that this error is thrown correctly',
    'ternary': 'Test both branches of the ternary operator'
  };

  return {
    description: suggestions[branch.type] || `Test ${branch.type} branch`,
    code: lineCode.trim(),
    testTemplate: generateTestTemplate(branch, lineCode.trim(), fileType)
  };
}

/**
 * 检测文件类型
 */
function detectFileType(filePath) {
  if (filePath.includes('/service/')) return 'service';
  if (filePath.includes('/controller/')) return 'controller';
  if (filePath.includes('/utils/') || filePath.includes('/helper')) return 'utils';
  if (filePath.includes('/common/') && (filePath.includes('constant') || filePath.includes('enum'))) return 'constants';
  if (filePath.includes('/schedule/')) return 'schedule';
  if (filePath.includes('/middleware/')) return 'middleware';
  if (filePath.includes('/bone/')) return 'bone';
  return 'general';
}

/**
 * 生成测试模板 - 根据文件类型定制
 */
function generateTestTemplate(branch, code, fileType = 'general') {
  // 根据文件类型选择模板
  const templates = {
    // Service 层模板
    service: {
      'if': `it('line ${branch.line}: should handle when ${branch.condition}', async () => {
  // Arrange
  app.mockService('dependencyService', 'methodName', async () => ({
    // mock return value
  }));

  const input = { /* TODO: set up condition where ${branch.condition} is false */ };

  // Act
  const result = await service.methodName(input);

  // Assert
  assert.ok(result);
  // TODO: Add assertions for the false branch
});`,
      'else': `it('line ${branch.line}: should handle else branch', async () => {
  // Arrange: Set up condition for else branch
  const input = { /* TODO: set up input */ };

  // Act
  const result = await service.methodName(input);

  // Assert
  assert.ok(result);
  // TODO: Add assertions for else branch behavior
});`,
      'catch': `it('line ${branch.line}: should handle ${branch.condition} error', async () => {
  // Arrange: Set up to trigger error
  app.mockService('dependencyService', 'methodName', async () => {
    throw new Error('${branch.condition}');
  });

  const input = { /* TODO: set up error condition */ };

  // Act & Assert
  await assert.rejects(
    () => service.methodName(input),
    /expected error message/
  );
});`,
      'throw': `it('line ${branch.line}: should throw error for invalid input', async () => {
  // Arrange
  const input = { /* TODO: invalid input */ };

  // Act & Assert
  await assert.rejects(
    () => service.methodName(input),
    /expected error/
  );
});`,
      'ternary': `it('line ${branch.line}: should handle both ternary branches', async () => {
  // Test branch 1 (true condition)
  const result1 = await service.methodName({ /* condition true */ });
  assert.strictEqual(result1.field, /* expected */);

  // Test branch 2 (false condition)
  const result2 = await service.methodName({ /* condition false */ });
  assert.strictEqual(result2.field, /* expected */);
});`
    },

    // Controller 层模板
    controller: {
      'if': `it('line ${branch.line}: should handle when ${branch.condition}', async () => {
  const user = await create('user');
  mockUser(user);

  app.mockService('serviceName', 'methodName', async () => ({
    // mock return
  }));

  const res = await app
    .httpRequest()
    .post('/api/endpoint')
    .send({ /* condition where ${branch.condition} */ });

  assert(res.status === 200);
  // TODO: Add assertions
});`,
      'else': `it('line ${branch.line}: should handle else branch', async () => {
  const user = await create('user');
  mockUser(user);

  const res = await app
    .httpRequest()
    .post('/api/endpoint')
    .send({ /* else condition */ });

  assert(res.status === 200 || res.status === 400);
});`,
      'catch': `it('line ${branch.line}: should handle error gracefully', async () => {
  const user = await create('user');
  mockUser(user);

  app.mockService('serviceName', 'methodName', async () => {
    throw new Error('${branch.condition}');
  });

  const res = await app
    .httpRequest()
    .post('/api/endpoint')
    .send({});

  assert(res.status === 500 || res.status === 200);
  if (res.status === 200) {
    assert(res.body.success === false);
  }
});`
    },

    // Utils 模板
    utils: {
      'if': `it('line ${branch.line}: should handle when ${branch.condition}', () => {
  const result = pureFunction(/* condition where ${branch.condition} */);
  assert.strictEqual(result, /* expected */);
});`,
      'else': `it('line ${branch.line}: should handle else branch', () => {
  const result = pureFunction(/* else condition */);
  assert.strictEqual(result, /* expected */);
});`,
      'ternary': `it('line ${branch.line}: should handle both ternary branches', () => {
  // Test true branch
  const result1 = pureFunction(/* true condition */);
  assert.strictEqual(result1, /* expected */);

  // Test false branch
  const result2 = pureFunction(/* false condition */);
  assert.strictEqual(result2, /* expected */);
});`
    },

    // 通用模板
    general: {
      'if': `it('line ${branch.line}: should handle when ${branch.condition}', async () => {
  // Arrange: Set up condition where ${branch.condition} is false
  const input = { /* TODO: set up input */ };

  // Act
  const result = await target.method(input);

  // Assert
  // TODO: Add assertions for the false branch
});`,
      'else': `it('line ${branch.line}: should handle else branch', async () => {
  // Arrange: Set up condition for else branch
  const input = { /* TODO: set up input */ };

  // Act
  const result = await target.method(input);

  // Assert
  // TODO: Add assertions for else branch behavior
});`,
      'catch': `it('line ${branch.line}: should handle ${branch.condition} error', async () => {
  // Arrange: Set up to trigger error
  const input = { /* TODO: set up error condition */ };

  // Act & Assert
  await assert.rejects(
    () => target.method(input),
    { message: /expected error pattern/ }
  );
});`,
      'throw': `it('line ${branch.line}: should throw error for invalid input', async () => {
  // Arrange
  const input = { /* TODO: invalid input */ };

  // Act & Assert
  assert.throws(() => {
    target.method(input);
  }, /expected error/);
});`,
      'ternary': `it('line ${branch.line}: should handle both ternary branches', async () => {
  // Test branch 1
  const result1 = await target.method({ /* condition true */ });
  assert.strictEqual(result1, /* expected */);

  // Test branch 2
  const result2 = await target.method({ /* condition false */ });
  assert.strictEqual(result2, /* expected */);
});`
    }
  };

  const typeTemplates = templates[fileType] || templates.general;
  return typeTemplates[branch.type] || `it('line ${branch.line}: should handle ${branch.type} branch', async () => {
  // TODO: Implement test for: ${code}
});`;
}

/**
 * 生成沙箱模式覆盖报告
 */
function generateSandboxReport() {
  console.log('📊 Generating Sandbox Mode Coverage Report...\n');

  // 读取 prd.json 获取目标文件
  let targetFiles = [];
  try {
    const prd = JSON.parse(fs.readFileSync('specmd/weavefox-test-loop/scripts/prd.json', 'utf-8'));
    if (prd.targetSourceFiles) {
      targetFiles = prd.targetSourceFiles;
    }
  } catch (e) {
    console.log('⚠️  No prd.json found or no targetSourceFiles specified');
  }

  // 如果没有指定目标文件，尝试从 test 目录推断
  if (targetFiles.length === 0) {
    const testFiles = glob.sync('test/**/*.test.ts', { cwd: process.cwd() });
    targetFiles = testFiles.map(tf => {
      // 从测试文件路径推断源文件路径
      return tf
        .replace('/test/', '/app/')
        .replace('.test.ts', '.ts')
        .replace(/^test\//, 'app/');
    }).filter(f => fs.existsSync(f));
  }

  let totalBranches = 0;
  let totalCovered = 0;

  console.log('='.repeat(80));
  console.log('Sandbox Coverage Analysis Report');
  console.log('='.repeat(80));

  targetFiles.forEach(sourceFile => {
    if (!fs.existsSync(sourceFile)) {
      console.log(`\n⚠️  Skipping non-existent file: ${sourceFile}`);
      return;
    }

    const analysis = analyzeSourceCoverage(sourceFile);
    totalBranches += analysis.totalBranches;
    totalCovered += analysis.coveredBranches;

    console.log(`\n📄 ${sourceFile}`);
    console.log(`   Test File: ${analysis.testFile || '❌ Not found'}`);
    console.log(`   Branches: ${analysis.coveredBranches}/${analysis.totalBranches} (${analysis.branchCoverage}%)`);
    console.log(`   Est. Line Coverage: ${analysis.estimatedLineCoverage}% (estimated via static analysis)`);

    if (analysis.uncoveredBranches.length > 0) {
      console.log('   Uncovered Branches:');
      analysis.uncoveredBranches.forEach(b => {
        console.log(`      Line ${b.line}: [${b.type}] ${b.condition}`);
      });
    }
  });

  const overallBranchCoverage = totalBranches > 0
    ? ((totalCovered / totalBranches) * 100).toFixed(2)
    : 0;

  // 估算总行覆盖率
  const overallLineCoverage = Math.min(100, (overallBranchCoverage * 0.85 + 10)).toFixed(2);

  console.log('\n' + '='.repeat(80));
  console.log('📊 SANDBOX MODE - Coverage Estimation Report');
  console.log('='.repeat(80));
  console.log(`Overall Branch Coverage: ${totalCovered}/${totalBranches} (${overallBranchCoverage}%)`);
  console.log(`Estimated Line Coverage: ${overallLineCoverage}% (static analysis)`);
  console.log('');
  console.log('⚠️  NOTE: These are ESTIMATED values based on static code analysis.');
  console.log('   Actual coverage may differ when tests are executed.');
  console.log('   To improve accuracy:');
  console.log('   1. Include line numbers in test descriptions (e.g., "line 45-47: should...")');
  console.log('   2. Use branch keywords in descriptions (e.g., "if", "else", "error")');
  console.log('   3. Run real tests when environment allows to verify');
  console.log('='.repeat(80));

  return {
    totalBranches,
    totalCovered,
    overallBranchCoverage: parseFloat(overallBranchCoverage),
    overallLineCoverage: parseFloat(overallLineCoverage),
    isEstimated: true
  };
}

function main() {
  // 源码分析模式
  if (isAnalyzeMode && analyzeTarget) {
    const analysis = analyzeSourceCoverage(analyzeTarget);

    if (isJsonMode) {
      // JSON 输出模式 - 供 AI 读取
      console.log(JSON.stringify(analysis, null, 2));
    } else {
      // 人类可读模式
      console.log(`🔍 Analyzing source file: ${analyzeTarget}\n`);
      console.log('='.repeat(60));
      console.log('Source Coverage Analysis');
      console.log('='.repeat(60));
      console.log(`Source: ${analysis.sourceFile}`);
      console.log(`Test File: ${analysis.testFile || '❌ Not found'}`);
      console.log(`\nBranch Coverage: ${analysis.coveredBranches}/${analysis.totalBranches} (${analysis.branchCoverage}%)`);
      console.log(`Estimated Line Coverage: ${analysis.estimatedLineCoverage}%`);

      if (analysis.uncoveredBranches.length > 0) {
        console.log('\n❌ Uncovered Branches (need tests):');
        analysis.uncoveredBranches.forEach(b => {
          console.log(`   Line ${b.line}: [${b.type}] ${b.condition}`);
          console.log(`   Code: ${b.suggestedTest.code}`);
          console.log(`   Suggestion: ${b.suggestedTest.description}`);
          console.log('');
        });
        console.log('\n💡 Test Templates:');
        analysis.uncoveredBranches.forEach((b, idx) => {
          console.log(`\n--- Template ${idx + 1} for Line ${b.line} ---`);
          console.log(b.suggestedTest.testTemplate);
        });
      } else {
        console.log('\n✅ All branches appear to be covered!');
      }
    }

    process.exit(analysis.uncoveredBranches.length > 0 ? 1 : 0);
  }

  // 报告模式
  if (isReportMode) {
    const report = generateSandboxReport();
    process.exit(report.overallBranchCoverage >= 80 ? 0 : 1);
  }

  // 标准/沙箱模式测试分析
  const testFiles = glob.sync('test/**/*.test.ts', { cwd: process.cwd() });

  console.log(isSandboxMode
    ? '🔍 [SANDBOX MODE] Scanning test files for anti-patterns...\n'
    : '🔍 Scanning test files for anti-patterns...\n'
  );

  let totalIssues = 0;
  let filesWithCriticalIssues = [];
  let allTestedFunctions = [];

  testFiles.forEach(file => {
    const result = analyzeTestFile(file);
    allTestedFunctions.push(...result.testedFunctions);

    if (result.issues.length > 0) {
      totalIssues += result.issues.length;
      console.log(`\n📄 ${file}`);
      console.log('─'.repeat(60));

      result.issues.forEach(issue => {
        const icon = issue.severity === 'CRITICAL' ? '❌' : '⚠️';
        console.log(`${icon} [${issue.severity}] ${issue.pattern}`);
        console.log(`   ${issue.description}`);
        console.log(`   Code: ${issue.snippet}...`);
      });

      if (result.hasCriticalIssues) {
        filesWithCriticalIssues.push(file);
      }
    }
  });

  console.log('\n' + '='.repeat(60));
  console.log(`📊 Summary: ${totalIssues} issues found in ${testFiles.length} files`);

  if (isSandboxMode) {
    console.log(`📋 Total unique functions tested: ${[...new Set(allTestedFunctions)].length}`);
  }

  if (filesWithCriticalIssues.length > 0) {
    console.log('\n❌ CRITICAL: The following files contain FAKE tests:');
    filesWithCriticalIssues.forEach(f => console.log(`   - ${f}`));
    console.log('\n⚠️  These tests MUST be deleted and regenerated with proper coverage intent.');
    process.exit(1);
  } else if (totalIssues > 0) {
    console.log('\n⚠️  Warning: Some tests may have quality issues. Review recommended.');
    process.exit(0);
  } else {
    console.log('\n✅ All tests look legitimate!');
    process.exit(0);
  }
}

main();
