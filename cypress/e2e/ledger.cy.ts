const unique = () => `e2e-${Date.now()}-${Math.floor(Math.random() * 1e5)}`;

function makeGroup(people = 'Ana, Ben, Cal') {
  const name = unique();
  cy.visit('/');
  cy.get('input[name=name]').type(name);
  cy.get('textarea[name=members]').type(people);
  cy.contains('button', 'Create group').click();
  cy.get('[data-testid=group-name]').should('have.text', name);
  return name;
}

function addExpense(description: string, amount: string, paidBy: string) {
  cy.get('input[name=description]').clear().type(description);
  cy.get('input[name=amount]').clear().type(amount);
  cy.get('select[name=paidBy]').select(paidBy);
  cy.contains('button', 'Add expense').click();
  cy.get('[data-testid=expense-saved]').should('be.visible');
}

describe('groups', () => {
  it('lists a new group on the home page', () => {
    const name = makeGroup();
    cy.visit('/');
    cy.contains('a', name).should('be.visible');
  });

  it('shows everyone as settled in a new group', () => {
    makeGroup();
    cy.get('[data-testid=all-settled]').should('contain', 'Everyone is square');
    cy.get('[data-testid=balance-Ana]').should('contain', 'settled');
  });

  it('shows a not-found page for an unknown group', () => {
    cy.visit('/groups/00000000-0000-4000-8000-000000000000', { failOnStatusCode: false });
    cy.contains('Group not found');
  });
});

describe('adding an expense', () => {
  it('moves the balances and lists the expense', () => {
    makeGroup();
    addExpense('Groceries', '30.00', 'Ana');
    cy.get('[data-testid=balance-Ana]').should('contain', 'is owed 20.00');
    cy.get('[data-testid=balance-Ben]').should('contain', 'owes 10.00');
    cy.get('[data-testid=expense]').should('have.length', 1).and('contain', 'Groceries').and('contain', '30.00');
  });

  it('splits an amount that does not divide evenly without losing a cent', () => {
    makeGroup();
    addExpense('Snack', '0.10', 'Ana');
    cy.get('[data-testid=transfer]').should('have.length', 2);
    // 10 cents over three people is 4, 3, 3: the owed total is 6 or 7 and each debt is 3 or 4.
    cy.get('[data-testid=transfer]').each(($t) => {
      expect($t.text()).to.match(/0\.0[34]/);
    });
  });

  it('only splits between the people ticked', () => {
    makeGroup();
    cy.get('input[name=sharedWith]').eq(2).uncheck();
    addExpense('Cab', '20.00', 'Ana');
    cy.get('[data-testid=balance-Cal]').should('contain', 'settled');
    cy.get('[data-testid=balance-Ben]').should('contain', 'owes 10.00');
  });
});

describe('validation', () => {
  it('names the problem on every empty field', () => {
    makeGroup();
    cy.contains('button', 'Add expense').click();
    cy.get('[data-testid=err-description]').should('be.visible');
    cy.get('[data-testid=err-amount]').should('be.visible');
    cy.get('[data-testid=err-paidBy]').should('be.visible');
    cy.get('[data-testid=expense]').should('not.exist');
  });

  it('refuses three decimal places', () => {
    makeGroup();
    cy.get('input[name=description]').type('Odd');
    cy.get('input[name=amount]').type('4.999');
    cy.get('select[name=paidBy]').select('Ben');
    cy.contains('button', 'Add expense').click();
    cy.get('[data-testid=err-amount]').should('contain', 'two decimal');
  });

  it('refuses a split with nobody ticked', () => {
    makeGroup();
    cy.get('input[name=sharedWith]').uncheck();
    cy.get('input[name=description]').type('Ghost');
    cy.get('input[name=amount]').type('5');
    cy.get('select[name=paidBy]').select('Ana');
    cy.contains('button', 'Add expense').click();
    cy.get('[data-testid=err-sharedWith]').should('contain', 'at least one');
  });

  it('refuses a group with one person', () => {
    cy.visit('/');
    cy.get('input[name=name]').type(unique());
    cy.get('textarea[name=members]').type('Solo');
    cy.contains('button', 'Create group').click();
    cy.get('[data-testid=err-members]').should('contain', 'at least two');
    cy.url().should('not.include', '/groups/');
  });

  it('refuses a group with no name', () => {
    cy.visit('/');
    cy.get('textarea[name=members]').type('Ana, Ben');
    cy.contains('button', 'Create group').click();
    cy.get('[data-testid=err-name]').should('contain', 'name');
  });
});

describe('settle up', () => {
  it('suggests two payments and clears them one by one', () => {
    makeGroup();
    addExpense('Rent', '90.00', 'Ana');
    cy.get('[data-testid=transfer]').should('have.length', 2).first().should('contain', 'pays Ana 30.00');
    cy.get('[data-testid=transfer]').first().contains('button', 'Mark paid').click();
    cy.get('[data-testid=transfer]').should('have.length', 1);
    cy.get('[data-testid=transfer]').first().contains('button', 'Mark paid').click();
    cy.get('[data-testid=all-settled]').should('be.visible');
    cy.get('[data-testid=balance-Ana]').should('contain', 'settled');
  });

  it('cancels what Ana and Ben owe each other before suggesting payments', () => {
    makeGroup();
    addExpense('Hotel', '60.00', 'Ana');
    addExpense('Dinner', '60.00', 'Ben');
    // Ana and Ben each paid 60 and share 40 of their own, so each is owed 20. Only Cal pays.
    cy.get('[data-testid=transfer]').should('have.length', 2);
    cy.get('[data-testid=balance-Cal]').should('contain', 'owes 40.00');
  });

  it('keeps the settlement after a reload', () => {
    makeGroup('Ana, Ben');
    addExpense('Lunch', '12.00', 'Ana');
    cy.get('[data-testid=transfer]').contains('button', 'Mark paid').click();
    cy.get('[data-testid=all-settled]').should('be.visible');
    cy.reload();
    cy.get('[data-testid=all-settled]').should('be.visible');
  });
});
