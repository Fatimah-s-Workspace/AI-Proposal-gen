export const proposalSectionTypes = [
  "executive-summary",
  "company-profile",
  "methodology",
  "technical-approach",
  "risk-management",
  "implementation-plan",
  "experience",
  "conclusion",
  "custom",
] as const;

export type ProposalSectionType = (typeof proposalSectionTypes)[number];

export interface ProposalGenerationRequest {
  sectionType: ProposalSectionType;
  projectContext: {
    title: string;
    clientName: string;
    opportunityType: string;
    sector: string;
    requirements: Array<{
      title: string;
      description: string;
      priority: string;
    }>;
    deadline?: Date;
    budgetRange?: string;
  };
  existingContent?: string;
  customPrompt?: string;
}

export interface ProposalGenerationResponse {
  content: string;
  version: number;
  wordCount: number;
  generatedAt: Date;
}

/**
 * Service for generating proposal sections aligned to tender requirements
 */
export class ProposalGenerationService {
  /**
   * Generate a proposal section
   */
  static async generateSection(
    request: ProposalGenerationRequest,
  ): Promise<ProposalGenerationResponse> {
    const { sectionType, projectContext } = request;

    try {
      // For now, return mock response - replace with actual AI call
      const mockContent = await this.generateMockContent(
        sectionType,
        projectContext,
      );

      return {
        content: mockContent,
        version: 1,
        wordCount: mockContent.split(/\s+/).length,
        generatedAt: new Date(),
      };
    } catch (error) {
      console.error("Error generating proposal section:", error);
      throw new Error("Failed to generate proposal section");
    }
  }

  /**
   * Build the prompt for section generation
   */
  private static buildSectionPrompt(
    sectionType: ProposalSectionType,
    projectContext: ProposalGenerationRequest["projectContext"],
    existingContent?: string,
    customPrompt?: string,
  ): string {
    const sectionTemplates = {
      "executive-summary": `
Write an executive summary for a ${projectContext.opportunityType} proposal in the ${projectContext.sector} sector.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}
- Deadline: ${projectContext.deadline ? projectContext.deadline.toLocaleDateString() : "Not specified"}
- Budget Range: ${projectContext.budgetRange || "Not specified"}

KEY REQUIREMENTS:
${projectContext.requirements.map((req) => `- ${req.title}: ${req.description}`).join("\n")}

EXECUTIVE SUMMARY GUIDELINES:
- Keep it concise (200-300 words)
- Highlight your unique value proposition
- Address key client requirements
- Show understanding of the project scope
- Demonstrate capability and experience
- Include clear next steps or call to action

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      "company-profile": `
Write a company profile section for a ${projectContext.opportunityType} proposal.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

COMPANY PROFILE GUIDELINES:
- Highlight relevant experience in ${projectContext.sector}
- Showcase key qualifications and certifications
- Demonstrate capacity to handle this type of project
- Include relevant case studies or past performance
- Show company stability and expertise
- Keep it professional and credible

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      methodology: `
Write a methodology section explaining your approach to delivering the ${projectContext.opportunityType}.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

KEY REQUIREMENTS TO ADDRESS:
${projectContext.requirements.map((req) => `- ${req.title}: ${req.description}`).join("\n")}

METHODOLOGY GUIDELINES:
- Explain your step-by-step approach
- Show how you'll meet each key requirement
- Demonstrate understanding of best practices
- Include quality assurance measures
- Show how you'll manage risks and issues
- Be specific and actionable

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      "technical-approach": `
Write a technical approach section detailing how you'll technically deliver the project requirements.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

TECHNICAL REQUIREMENTS:
${projectContext.requirements.map((req) => `- ${req.title}: ${req.description}`).join("\n")}

TECHNICAL APPROACH GUIDELINES:
- Detail technical solutions for each requirement
- Explain technology stack and tools to be used
- Show technical expertise and innovation
- Address scalability and performance requirements
- Include technical risk mitigation
- Be specific about deliverables and specifications

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      "risk-management": `
Write a risk management section identifying potential risks and mitigation strategies.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}
- Deadline: ${projectContext.deadline ? projectContext.deadline.toLocaleDateString() : "Not specified"}

RISK MANAGEMENT GUIDELINES:
- Identify key project risks (technical, operational, financial, timeline)
- Assess probability and impact of each risk
- Provide specific mitigation strategies
- Show contingency planning
- Demonstrate proactive risk management approach
- Include monitoring and reporting mechanisms

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      "implementation-plan": `
Write an implementation plan section with detailed project schedule, milestones, and delivery assurance.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}
- Deadline: ${projectContext.deadline ? projectContext.deadline.toLocaleDateString() : "Not specified"}

KEY REQUIREMENTS:
${projectContext.requirements.map((req) => `- ${req.title}: ${req.description}`).join("\n")}

IMPLEMENTATION PLAN GUIDELINES:
- Create realistic timeline based on project scope
- Include key milestones and deliverables
- Show critical path items
- Include buffer time for unexpected delays
- Align with project deadline
- Include dependencies and parallel activities

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,

      experience: `
Write an experience section showcasing similar projects, results, and evidence of delivery.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

EXPERIENCE GUIDELINES:
- Highlight 2-3 comparable projects
- Provide client, scope, year, and measurable outcomes
- Show relevance to the current tender
- Emphasize delivery, compliance, and evidence readiness
- Avoid generic claims and use concrete examples

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,
      conclusion: `
Write a conclusion section that reinforces compliance, clarity, and the bidder's readiness.

PROJECT DETAILS:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

CONCLUSION GUIDELINES:
- Summarize key strengths and compliance
- Highlight evidence and next steps
- Keep it concise and persuasive
- Avoid generic marketing language

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
${customPrompt ? `ADDITIONAL INSTRUCTIONS:\n${customPrompt}` : ""}
`,
      custom: `
Write a custom proposal section.

${customPrompt ? `INSTRUCTIONS:\n${customPrompt}` : "Please provide specific instructions for this custom section."}

PROJECT CONTEXT:
- Title: ${projectContext.title}
- Client: ${projectContext.clientName}
- Sector: ${projectContext.sector}

${existingContent ? `EXISTING CONTENT TO IMPROVE:\n${existingContent}` : ""}
`,
    };

    return sectionTemplates[sectionType] || sectionTemplates.custom;
  }

  /**
   * Generate mock content for development
   */
  private static async generateMockContent(
    sectionType: ProposalSectionType,
    projectContext: ProposalGenerationRequest["projectContext"],
  ): Promise<string> {
    // Simulate API delay
    await new Promise((resolve) => setTimeout(resolve, 1500));

    const mockContent = {
      "executive-summary": `# Executive Summary

We are pleased to submit this comprehensive proposal for the ${projectContext.title} project. As a leading provider in the ${projectContext.sector} sector, we bring extensive experience and proven methodologies to deliver exceptional results for ${projectContext.clientName}.

## Our Understanding
This ${projectContext.opportunityType} represents a critical opportunity to ${projectContext.requirements.length > 0 ? projectContext.requirements[0].description : "deliver high-quality services"}. We understand the importance of meeting all specified requirements while maintaining the highest standards of quality and compliance.

## Our Approach
Our proven methodology combines technical expertise with industry best practices to ensure successful project delivery. We will leverage our team's deep knowledge of ${projectContext.sector} requirements and regulatory frameworks to provide innovative solutions that exceed expectations.

## Key Strengths
- **Proven Track Record**: Successfully delivered similar projects with 100% client satisfaction
- **Expert Team**: Certified professionals with average 15+ years of experience
- **Quality Assurance**: Comprehensive quality management system ensuring compliance
- **Risk Management**: Proactive identification and mitigation of project risks

## Commitment to Success
We are committed to delivering this project on time and within budget, while maintaining open communication and transparency throughout the engagement. Our goal is not just to meet requirements, but to exceed expectations and build a long-term partnership with ${projectContext.clientName}.

We look forward to the opportunity to discuss how we can contribute to your success.`,

      "company-profile": `# Company Profile

## About Our Company
With over 20 years of experience in the ${projectContext.sector} sector, we have established ourselves as a trusted partner for organizations seeking reliable and innovative solutions. Our commitment to excellence and client satisfaction has made us a preferred choice for ${projectContext.opportunityType} opportunities.

## Core Competencies
- **Technical Expertise**: Deep knowledge of ${projectContext.sector} requirements and best practices
- **Regulatory Compliance**: Full compliance with all relevant industry standards and regulations
- **Quality Management**: ISO 9001 certified quality management system
- **Innovation**: Continuous investment in technology and process improvements

## Relevant Experience
Our portfolio includes successful delivery of numerous projects similar to the ${projectContext.title}, demonstrating our capability to handle complex requirements and deliver results that exceed client expectations.

## Our Team
Our multidisciplinary team brings together experts from various fields, ensuring comprehensive coverage of all project aspects. Each team member holds relevant certifications and maintains continuous professional development.

## Commitment to Excellence
We are dedicated to maintaining the highest standards of professionalism, integrity, and quality in all our engagements. Our goal is to build lasting partnerships based on trust, reliability, and mutual success.`,

      methodology: `# Project Methodology

## Overview
Our methodology for the ${projectContext.title} is based on industry best practices and proven frameworks adapted to the specific requirements of this ${projectContext.opportunityType}. We follow a structured approach that ensures quality, compliance, and successful delivery.

## Phase 1: Planning and Preparation
- Comprehensive requirements analysis and validation
- Detailed project planning and resource allocation
- Risk assessment and mitigation strategy development
- Stakeholder engagement and communication planning

## Phase 2: Execution
- Implementation following established quality standards
- Regular progress monitoring and reporting
- Continuous quality assurance and compliance checking
- Proactive issue identification and resolution

## Phase 3: Testing and Validation
- Comprehensive testing against all specified requirements
- Quality assurance and validation processes
- Documentation and record keeping
- Final review and approval processes

## Phase 4: Delivery and Handover
- Final delivery preparation and documentation
- Knowledge transfer and training (if required)
- Post-delivery support and maintenance
- Performance monitoring and optimization

## Quality Assurance
Throughout all phases, we maintain rigorous quality control processes, regular audits, and compliance monitoring to ensure all deliverables meet the highest standards and fully address the project requirements.`,

      "technical-approach": `# Technical Approach

## Solution Architecture
Our technical approach for the ${projectContext.title} leverages modern technologies and best practices to deliver a robust, scalable, and compliant solution that fully addresses all specified requirements.

## Technology Stack
- **Core Systems**: Enterprise-grade platforms ensuring reliability and performance
- **Integration Layer**: Seamless integration with existing client systems
- **Security Framework**: Multi-layered security approach protecting sensitive data
- **Monitoring Tools**: Real-time monitoring and alerting systems

## Key Technical Components
${projectContext.requirements
  .map(
    (req) => `### ${req.title}
${req.description}

**Technical Solution**: Implementation of [specific technology/solution] to address this requirement, ensuring compliance and optimal performance.`,
  )
  .join("\n\n")}

## Performance and Scalability
The solution is designed to handle current requirements while providing scalability for future growth. Performance optimization and load testing ensure the system can handle peak loads efficiently.

## Security and Compliance
All technical implementations follow industry security standards and compliance requirements relevant to the ${projectContext.sector} sector. Regular security assessments and updates ensure ongoing protection.

## Testing and Validation
Comprehensive testing protocols including unit testing, integration testing, performance testing, and user acceptance testing ensure the solution meets all technical specifications and requirements.`,

      "risk-management": `# Risk Management

## Risk Management Approach
We employ a comprehensive risk management framework that proactively identifies, assesses, and mitigates potential risks throughout the project lifecycle. Our approach ensures minimal disruption and maximum protection of project objectives.

## Identified Risks

### Technical Risks
- **Technology Integration Challenges**: Potential compatibility issues with existing systems
- **Performance Limitations**: System performance not meeting requirements
- **Data Migration Issues**: Challenges in migrating existing data

### Operational Risks
- **Resource Availability**: Key personnel availability and skill gaps
- **Vendor Dependencies**: Reliance on third-party suppliers or services
- **Scope Changes**: Uncontrolled changes to project scope

### External Risks
- **Regulatory Changes**: Changes in relevant regulations or standards
- **Market Conditions**: Economic or market factors affecting the project
- **Force Majeure**: Unforeseeable circumstances beyond our control

## Mitigation Strategies
For each identified risk, we have developed specific mitigation strategies including:
- Contingency planning and backup solutions
- Regular risk monitoring and reporting
- Stakeholder communication protocols
- Escalation procedures for critical issues

## Risk Monitoring
We maintain a risk register updated throughout the project with regular risk assessments and status reporting to all stakeholders. This ensures proactive management and early intervention when required.

## Contingency Planning
Detailed contingency plans are developed for high-impact risks, ensuring business continuity and minimal impact on project timelines and deliverables.`,

      "implementation-plan": `# Implementation Timeline

## Project Timeline Overview
The ${projectContext.title} will be executed over [X] months/weeks, with key milestones aligned to ensure timely delivery and compliance with all requirements.

## Phase 1: Initiation and Planning (Weeks 1-2)
- Project kickoff and team mobilization
- Detailed requirements validation
- Project plan development and approval
- Resource allocation and procurement

## Phase 2: Design and Development (Weeks 3-8)
- Solution design and architecture finalization
- Development of core components
- Integration with existing systems
- Initial testing and quality assurance

## Phase 3: Testing and Validation (Weeks 9-10)
- Comprehensive system testing
- User acceptance testing
- Performance optimization
- Final quality assurance

## Phase 4: Deployment and Go-Live (Weeks 11-12)
- Production deployment preparation
- Data migration and system cutover
- User training and knowledge transfer
- Go-live support and monitoring

## Key Milestones
- **Milestone 1**: Requirements finalized and approved
- **Milestone 2**: Solution design completed
- **Milestone 3**: Development completed and tested
- **Milestone 4**: Successful go-live and handover

## Critical Path Items
- Regulatory approvals and compliance verification
- Integration with critical client systems
- User training and acceptance

## Monitoring and Reporting
Weekly progress reports and milestone reviews ensure transparency and early identification of any schedule deviations. Regular stakeholder meetings maintain alignment and address any concerns promptly.`,

      experience: `# Relevant Experience

We have successfully delivered multiple projects similar to ${projectContext.title}, demonstrating our ability to meet complex tender requirements in the ${projectContext.sector} sector.

## Key Projects
- Project A: Delivered [solution] for [client], meeting [specific requirements] and achieving [outcome].
- Project B: Implemented [solution] with strong compliance controls and on-time delivery.
- Project C: Provided scalable, secure services aligned to regulatory and contractual expectations.

## Value Proposition
Our experience shows that we can deliver high-quality results while maintaining strict compliance and strong stakeholder communication.
`,

      conclusion: `# Conclusion

In summary, our proposal for the ${projectContext.title} is built on strong compliance, relevant experience, and a practical delivery approach tailored to ${projectContext.clientName}.

## Why Us
- Proven track record in ${projectContext.sector}
- Strong alignment with the stated requirements
- Practical risk mitigation and delivery planning
- Commitment to quality and communication

We look forward to the opportunity to support ${projectContext.clientName} and deliver this project successfully.
`,

      custom: `# Custom Section

This is a custom section that can be tailored to specific project requirements. Please provide detailed instructions for the content you would like included in this section.

## Project Context
- **Project**: ${projectContext.title}
- **Client**: ${projectContext.clientName}
- **Sector**: ${projectContext.sector}
- **Type**: ${projectContext.opportunityType}

## Key Requirements
${projectContext.requirements.map((req) => `- ${req.title}: ${req.description}`).join("\n")}

Please specify the exact content and focus areas you would like covered in this custom section.`,
    };

    return mockContent[sectionType] || mockContent.custom;
  }

  /**
   * Regenerate a section with improvements
   */
  static async regenerateSection(
    request: ProposalGenerationRequest & { existingContent: string },
  ): Promise<ProposalGenerationResponse> {
    // Add regeneration instructions to the prompt
    const regenerationRequest = {
      ...request,
      customPrompt:
        (request.customPrompt || "") +
        "\n\nIMPROVE this existing content by making it more compelling, adding specific details, and better addressing the project requirements. Maintain the same structure but enhance the quality and specificity.",
    };

    return this.generateSection(regenerationRequest);
  }
}
